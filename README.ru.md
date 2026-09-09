<div align="center">

# ◈ cc-skill-router

### Проектно-осознанный советчик по skills для Claude Code

**Хук `SessionStart` · Советует, не запускает сам · Ноль затрат на каждый ход**

[![Lint](https://github.com/Alpha-Oi/cc-skill-router/actions/workflows/lint.yml/badge.svg)](https://github.com/Alpha-Oi/cc-skill-router/actions/workflows/lint.yml)
[![Лицензия: MIT](https://img.shields.io/badge/license-MIT-22a06b.svg)](LICENSE)
[![Последний коммит](https://img.shields.io/github/last-commit/Alpha-Oi/cc-skill-router?color=1f6feb)](https://github.com/Alpha-Oi/cc-skill-router/commits/main)

[English](README.md) · [Русский](README.ru.md) · [Как внести вклад](CONTRIBUTING.md) · [Правила сообщества](CODE_OF_CONDUCT.md) · [Безопасность](SECURITY.md)

</div>

---

Глобальный skill для Claude Code плюс хук `SessionStart`, который подсказывает, какой
из установленных skills подходит под задачу, с проектно-осознанными альтернативами.
**Советует, никогда не запускает сам.**

Claude Code и так маршрутизирует к skill, когда запрос совпадает с его `description`.
Здесь добавлено то, чего штатная маршрутизация не делает:

- **однократный на сессию, проектно-осознанный** индекс того, что установлено, и
  выполнены ли предусловия каждого skill;
- **проектно-осознанные альтернативы** — если skill требует issue-трекера или
  словаря меток, которых в этом репозитории нет, предлагается шаг настройки;
- осведомлённость о **slash-only** skills (`disable-model-invocation`), которые
  штатная маршрутизация сама никогда не показывает;
- **список «никогда не запускать автоматически»** для тяжёлых или внешних skills
  (`code-review`, `security-review`, всё, что пишет во внешние системы).

## Составные части

| Файл | Роль |
|---|---|
| [`skills/skill-router/SKILL.md`](skills/skill-router/SKILL.md) | логика маршрутизации — загружается по требованию при вызове `Skill(skill-router)` или автосовпадении по `description` |
| [`skills/skill-router/analyze-project.mjs`](skills/skill-router/analyze-project.mjs) | скрипт хука `SessionStart` — вставляет одноразовый проектно-осознанный индекс skills в начале каждой сессии |

Скрипт читает только файловую систему — папки skills в `~/.claude/skills` и
`<project>/.claude/skills`, плюс несколько маркерных файлов в корне проекта. Без сети,
без записи. При любой ошибке ничего не печатает и выходит с кодом 0, поэтому никогда
не может заблокировать сессию.

## Установка

### Вариант A — `npx skills`

```bash
npx skills add https://github.com/Alpha-Oi/cc-skill-router --skill skill-router
```

Затем добавьте хук (см. ниже): `npx skills` ставит skill, но не хук в `settings.json`.

### Вариант B — вручную

1. Скопируйте `skills/skill-router/` в `~/.claude/skills/skill-router/`.
2. Добавьте хук `SessionStart` в `~/.claude/settings.json` (слейте с существующими
   ключами, не заменяйте файл целиком):

```jsonc
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"~/.claude/skills/skill-router/analyze-project.mjs\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

На Windows `~` в команде может не раскрыться — укажите абсолютный путь, например
`node "C:/Users/<you>/.claude/skills/skill-router/analyze-project.mjs"`.

3. Перезапустите Claude Code (или начните новую сессию). Хук срабатывает в начале
   сессии, не в середине.

## Как это ведёт себя

В начале сессии скрипт вставляет компактный блок: корень проекта, какие маркерные
файлы присутствуют, настроены ли issue-трекер и triage-метки, список установленных
skills (с пометкой slash-only) и правила маршрутизации. В ходе сессии Claude:

- **рекомендует** skill при явном совпадении — одной строкой, с причиной, затем ждёт
  вашего согласия;
- **предлагает шаг настройки** вместо этого, когда предусловия совпавшего skill не
  выполнены;
- **никогда не запускает автоматически** `code-review`, `security-review`, slash-only
  skills и всё, что пишет во внешние системы — только предлагает;
- **молчит** про маршрутизацию, когда ничего не подходит, и просто делает работу.

Новые skills не требуют правок — хук перечитывает папки skills каждую сессию, поэтому
всё, что вы установите позже, подхватывается автоматически.

## Стоимость в токенах

Одна вставка на сессию — несколько сотен токенов, растёт с числом установленных
skills. Ничего на каждый ход. Полная логика `SKILL.md` загружается только тогда, когда
маршрутизация действительно происходит.

## Настройка

- Таблица и правила маршрутизации: правьте `SKILL.md`.
- Сколько вставляет хук (лимит длины description, какие маркеры сообщать, какие строки
  правил печатать): правьте `analyze-project.mjs`.
- Текст вставляемых подсказок на русском; чтобы перевести, измените строки `log(...)`
  в `analyze-project.mjs`.

## Отключение

Удалите блок `SessionStart` из `~/.claude/settings.json`. Чтобы удалить полностью,
также удалите `~/.claude/skills/skill-router/`.

## Лицензия

MIT — см. [LICENSE](LICENSE).
