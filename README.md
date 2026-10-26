# Дубовый Двор — магазин мебели с кнопкой хаоса

Демо-сайт магазина мебели на Express. На странице одна кнопка: **«Сломать случайный файл»**.
Она выбирает случайный исправный файл из списка и портит его, после чего сайт и health check начинают падать — и это нужно чинить.

## Команды

| | |
|---|---|
| Install Command | `npm install` |
| Start Command | `npm start` (= `node server.js`) |
| Health Check Path | `/api/health` |

`/api/health` отвечает `200 {"status":"ok"}`, когда всё исправно, и `503 {"status":"broken"}` со списком сломанных файлов.

## Как ломается файл

- **Есть `GITHUB_TOKEN`** (так работает на Vercel): сервер делает коммит в репозиторий с испорченным файлом через GitHub API → Vercel автоматически пересобирает сайт → прод сломан.
  Токен: fine-grained PAT с доступом `Contents: Read and write` только к этому репозиторию. Добавьте его в Vercel → Settings → Environment Variables как `GITHUB_TOKEN` и сделайте Redeploy.
- **Нет токена** (локальный запуск): файл портится прямо на диске.

Файлы, которые могут сломаться: `data/*.json`, `lib/*.js`, `views/index.html`, `views/app.js`.

## Как чинить

Найти сломанный файл в `/api/health`, затем откатить коммит `chaos: break …` (`git revert <sha>`) или поправить файл вручную.
Локально: `git checkout -- .`
