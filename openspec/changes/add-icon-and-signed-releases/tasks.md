# Tasks

## 1. Иконка

- [x] 1.1 Нарисовать `src/icons/icon.svg`: `viewBox` 128×128, фон `#D6001C`, три белые «h» из `<path>` без `<text>`, штрихи по сетке 8 единиц (1 px при 16 px). Проверка: в файле нет `<text>` и `font`, а при растеризации в 16×16 и 48×48 (например, через `rsvg-convert` или в браузере) видны три отдельные буквы.
- [x] 1.2 Добавить в `src/manifest.json` `"icons": { "48": "icons/icon.svg", "96": "icons/icon.svg" }`, а в `scripts/build.ts` копировать `src/icons/` в `dist/icons/`. Проверка: после `npm run build` есть `dist/icons/icon.svg`, `npm run lint` без ошибок.

## 2. Единая версия и манифест

- [x] 2.1 В `scripts/build.ts` брать `version` из `package.json` и записывать `dist/manifest.json` с этой версией. Удалить `version` из `src/manifest.json`. Проверка: после `npm run build` выполнить `node -p "require('./dist/manifest.json').version"`, должно совпасть с версией из `package.json`. Временно поменять версию в `package.json`: в `dist` она тоже меняется.
- [x] 2.2 В `src/manifest.json` заменить gecko `id` на `hh-helper-ext@alexandrlo.github.io` и добавить `update_url`: `https://github.com/AlexandrLo/hh-helper-ext/releases/latest/download/updates.json`. Проверка: `npm run lint` (с `--self-hosted`) без ошибок и предупреждений про `update_url` и `id`.

## 3. Workflow выпуска

- [x] 3.1 Создать `.github/workflows/release.yml` по схеме из design.md: push в `main`, `permissions: contents: write`, `concurrency: release`, Node 25, `npm ci`, test, typecheck, lint, поиск релиза `v<version>` через `gh release view`. Проверка: `actionlint` (если доступен) без ошибок, шаги подписи и релиза запускаются только когда релиза нет.
- [x] 3.2 Добавить шаги подписи и релиза: `git archive` → `source.zip`, `web-ext sign -s dist --channel unlisted --upload-source-code source.zip --approval-timeout 900000` с `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET` из секретов `AMO_JWT_ISSUER`/`AMO_JWT_SECRET`, переименование в `hh-helper-ext-<version>.xpi`, генерация `updates.json` (`scripts/updates-json.ts`: id, version, `update_link` на `releases/download/v<version>/...`), `actions/upload-artifact`, `gh release create v<version> --target $GITHUB_SHA --latest --generate-notes`. Проверка: локально прогнать скрипт генерации `updates.json` для версии `0.1.0` и сверить JSON с форматом обновлений Firefox (`addons.<id>.updates[].version`/`update_link`).

## 4. Документация

- [x] 4.1 Обновить `README.md`: установка из GitHub Releases вместо временной (временный способ оставить для разработки), автообновление, выпуск новой версии (поднять `version` в `package.json` и запушить в `main`), настройка секретов AMO, восстановление после сбоя между подписью и релизом. Проверка: команды из README выполняются как написано (`npm run build`, `npm run package`).

## 5. Интеграционная проверка

- [ ] 5.1 После добавления секретов и пуша в `main` убедиться, что прогон создал релиз `v0.1.0` с `hh-helper-ext-0.1.0.xpi` и `updates.json`, а `curl -L https://github.com/AlexandrLo/hh-helper-ext/releases/latest/download/updates.json` возвращает JSON с версией `0.1.0`.
- [ ] 5.2 Поставить `.xpi` из релиза в Zen/Firefox Release, перезапустить браузер. Проверка: расширение на месте, иконка «hhh» видна в `about:addons` и в меню расширений, бейджи на hh.ru работают.
- [ ] 5.3 Запушить коммит без смены версии. Проверка: прогон зелёный, нового релиза нет.
- [ ] 5.4 Поднять версию до `0.1.1` и запушить. Проверка: появился релиз `v0.1.1`, и после «Проверить наличие обновлений» в `about:addons` установленное расширение обновилось до `0.1.1`.
