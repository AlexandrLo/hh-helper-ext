# Design

## Context

- `scripts/build.ts` собирает `src/background.ts` и `src/content.ts` esbuild'ом в `dist/` и копирует `src/manifest.json` без изменений. Иконок и `.github/` в проекте нет.
- Версия `0.1.0` записана в двух местах: `package.json` и `src/manifest.json`.
- `npm run package` собирает неподписанный `web-ext-artifacts/hh-helper-ext.xpi`. `web-ext` (`^10.8.0`) уже стоит в devDependencies, в нём есть `web-ext sign` с параметрами `--channel`, `--approval-timeout` и `--upload-source-code`. Ключи он также читает из `WEB_EXT_API_KEY` и `WEB_EXT_API_SECRET`.
- Тесты запускают `.ts` напрямую, поэтому нужен Node 25+.
- Репозиторий `AlexandrLo/hh-helper-ext` публичный, ветка по умолчанию `main`.

## Goals / Non-Goals

**Goals:**
- Один workflow, который проверяет каждый push в `main` и выпускает подписанный релиз только при новой версии.
- Сборка остаётся единственным местом, где получается манифест для `dist/`.

**Non-Goals:**
- Публичный листинг на AMO, метаданные и скриншоты.
- Проверки pull request'ов и других веток.
- Автоматическое повышение версии и changelog. Примечания к релизу генерирует GitHub.
- Кнопка на панели инструментов (`action`) и popup.

## Decisions

### Иконка: один SVG, буквы контурами

`src/icons/icon.svg`, `viewBox="0 0 128 128"`, фон `#D6001C` со скруглением `rx=24`. Три «h» нарисованы белыми `<path>`, без `<text>`: так начертание не зависит от шрифтов (см. spec `extension-icon`). Вся геометрия лежит на сетке 8 единиц (= 1 px при 16×16): штрих, просвет внутри буквы и промежуток между буквами кратны 8, поэтому в 16 px каждая буква — чёткие пиксельные полосы без размытия. Штрихи толще (12–16/128) проверялись: при 16 px они попадают между пикселями, и буквы сливаются.

В манифесте: `"icons": { "48": "icons/icon.svg", "96": "icons/icon.svg" }`. Firefox масштабирует SVG сам.

- Альтернатива: набор PNG 16/32/48/96/128. Понадобился бы растеризатор в сборке или бинарники в репозитории, а Firefox отрисует SVG сам. Отклонено.

### Версия: `package.json` → `dist/manifest.json`

`scripts/build.ts` читает `package.json`, разбирает `src/manifest.json`, записывает в него `version` и сохраняет в `dist/manifest.json` (вместо `copyFile`). Поле `version` из `src/manifest.json` удаляется, чтобы второй источник не появился снова. Иконки копируются в `dist/icons/`.

- Альтернатива: проверка в CI, что две версии совпадают. Оставляет ручную синхронизацию. Отклонено.

### Идентификатор и `update_url`

В `browser_specific_settings.gecko`:
- `id`: `hh-helper-ext@alexandrlo.github.io`
- `update_url`: `https://github.com/AlexandrLo/hh-helper-ext/releases/latest/download/updates.json`

Каждый релиз прикладывает свой `updates.json` с одной записью: `version` и `update_link` = `https://github.com/AlexandrLo/hh-helper-ext/releases/download/v<version>/hh-helper-ext-<version>.xpi`. Путь `latest/download` всегда ведёт к файлу последнего релиза.

- Альтернатива: `updates.json` в репозитории (raw или GitHub Pages). Тогда CI пришлось бы коммитить в `main` или настраивать Pages. Отклонено.
- `update_url` разрешён для unlisted-дополнений. В listed его запрещают, но этот канал мы не используем. По умолчанию `web-ext lint` проверяет как для AMO-листинга и считает `update_url` ошибкой (`MANIFEST_UPDATE_URL`), поэтому `npm run lint` запускается с `--self-hosted`.

### Workflow `.github/workflows/release.yml`

```
on: push (branches: main)
permissions: contents: write
concurrency: release (без отмены текущего прогона)

checkout -> setup-node 25 (cache npm) -> npm ci
  -> npm test -> npm run typecheck -> npm run lint
  -> V = version из package.json
  -> gh release view vV ? -> есть: конец
  -> git archive HEAD -> source.zip
  -> web-ext sign -s dist --channel unlisted
       --upload-source-code source.zip --approval-timeout 15 мин
  -> переименовать подписанный .xpi в hh-helper-ext-V.xpi
  -> сгенерировать updates.json
  -> upload-artifact (xpi + updates.json)
  -> gh release create vV --target $GITHUB_SHA --latest --generate-notes
       hh-helper-ext-V.xpi updates.json
```

- Один job: шагов мало, а разделение на jobs заставило бы передавать `dist/` через артефакты.
- Существование версии проверяется по **релизу**, а не по тегу: тег без релиза (например, после неудачной попытки) не помешает выпуску.
- `--upload-source-code`: `dist/` собран бандлером, и правила AMO просят исходники для обработанного кода. `git archive` даёт ровно содержимое коммита.
- Секреты `AMO_JWT_ISSUER` и `AMO_JWT_SECRET` передаются в шаг подписи как `WEB_EXT_API_KEY` и `WEB_EXT_API_SECRET`, а не параметрами командной строки.
- `concurrency` без `cancel-in-progress`: два быстрых пуша не отправят в AMO одну версию дважды параллельно.
- Сторонние actions: только `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`. Релиз создаёт `gh`.

## Risks / Trade-offs

- [Подпись прошла, а `gh release create` упал. Повтор прогона не сработает: AMO не принимает уже подписанную версию.] → Подписанный `.xpi` и `updates.json` сохраняются как артефакт workflow до создания релиза. Восстановление: создать релиз вручную из артефакта или поднять patch-версию. Это описывается в README.
- [Firefox может не пройти редирект `latest/download` → `objects.githubusercontent.com` при проверке обновлений.] → Проверено 2026-10-19 в Zen 1.23.3b: обновление `0.1.0` → `0.1.1` нашлось и установилось. Запасной вариант на случай поломки: `updates.json` на GitHub Pages.
- [Проверка AMO затянется дольше 15 минут.] → Прогон падает без релиза. Повторный запуск подхватит уже отправленную версию или упадёт на дубликате, и тогда поможет восстановление выше.
- [Смена id `@local` → `@alexandrlo.github.io`.] → Затрагивает только временную установку: её удаляют вручную один раз.
- [Каждое повышение версии в `main` сразу уходит в AMO под аккаунтом владельца.] → Это осознанная схема «релиз по bump'у». Ошибочную версию можно только перекрыть следующей.

## Migration Plan

1. Владелец создаёт API-ключ на addons.mozilla.org (Developer Hub → Manage API Keys) и добавляет секреты `AMO_JWT_ISSUER` и `AMO_JWT_SECRET` в репозиторий.
2. Изменение попадает в `main`. Релиза `v0.1.0` ещё нет, поэтому первый прогон выпускает `v0.1.0`. Первая unlisted-подпись создаёт дополнение в AMO.
3. Пользователь удаляет временную установку и ставит `hh-helper-ext-0.1.0.xpi` из релиза.
4. Откат: удалить релиз на GitHub. В AMO подписанную версию можно отключить в Developer Hub.
