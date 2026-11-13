# Инструменты для материалов сдачи

Скрипты, которыми сделаны скриншоты, презентация и ролик. Им нужен запущенный dev-сервер приложения на `localhost:5173` и Playwright (в облачной среде Chromium уже стоит).

Скрипты ожидают рабочую папку такого вида и запускаются из неё:

```
work/
  tools/        ← содержимое этой папки tools/
  demo/         ← run.cjs и answers.json из tools/demo
  audio/question.wav   ← любая короткая запись голоса, 16 кГц моно
  video/        ← tools/video + npm install
  out/
```

| Скрипт                | Что делает                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `demo/run.cjs`        | Две тренировки подряд с живой моделью; скриншоты в `demo/m/` и `state.json` с памятью        |
| `tools/hires.cjs`     | Скриншоты всех экранов в двойной плотности по сохранённой памяти (`demo/hi/`)               |
| `tools/auras.cjs`     | Рендерит градиенты для слайдов кодом приложения (`src/lib/aura.ts`)                         |
| `tools/bigmark2.cjs`  | Большой знак с прозрачным фоном                                                             |
| `tools/deck.cjs`      | Презентация → PDF и проверка переполнения слайдов                                           |
| `tools/slides.cjs`    | PNG каждого слайда в `out/`                                                                 |
| `tools/record.cjs`    | Живые клипы приложения для ролика через CDP-скринкаст в двойной плотности (`video/public/clips/`) |
| `tools/music.py`      | Саундтрек 64 с, 120 BPM: пэд, бас, бочка, хэты, арпеджио, свиши, удары, щелчки — только numpy |
| `tools/video/`        | Remotion-проект ролика (`Promo.tsx`): сцены, 3D-телефоны, кинетический текст                |

Ролик:

```bash
cd video
npm i remotion@4.0.543 @remotion/cli@4.0.543 @remotion/renderer@4.0.543 react@19.2.0 react-dom@19.2.0 @fontsource-variable/inter @fontsource-variable/unbounded
cp ../path/to/docs/presentation/img/{aura-*.png,mark.png} public/
python3 ../tools/music.py public/audio/track.wav
npx remotion render src/index.ts Promo out/promo.mp4 --codec=h264 --crf=18 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
```

Склейки сцен стоят на сильных долях трека: 6, 10, 16, 30, 38, 46, 50, 56 с. Меняешь сцены в `Promo.tsx` — сдвинь звуковые акценты в `music.py`.
