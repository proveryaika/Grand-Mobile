# NEON STRIKE
Самостоятельный мобильный онлайн-прототип тактической арены. Не копирует защищённые карты, логотипы, интерфейс или игровые ресурсы Standoff 2.

## Подготовлено
- Адаптивный интерфейс авторизации и игрового кабинета.
- Email/password и кнопка Google OAuth (после настройки Google provider в Supabase).
- UI для VK ID; для активации нужны OAuth-настройки приложения VK.
- Разделы профиля, инвентаря, бесплатного контейнера, маркета и админ-панели.
- Публичный Supabase publishable key; секретный service-role key не используется в браузере.

## Настройка
1. В Supabase Auth включить подтверждение почты и настроить Google OAuth credentials.
2. Настроить VK ID OAuth через совместимый OAuth/OIDC-провайдер.
3. Добавить URL сайта в Auth redirect URLs.
4. Применить SQL migration из supabase/migrations.
5. Проверить RLS и административные RPC перед публичным запуском.

Контейнеры бесплатные, шансы показываются заранее, награды косметические. Полноценные соревновательные матчи, античит и authoritative game server потребуют отдельного backend.

## Перед первым запуском
- В настройках репозитория открой **Settings → Pages** и выбери **GitHub Actions** как источник публикации. Автоматическое включение Pages через workflow недоступно для текущего GitHub-подключения.
- В Supabase Dashboard → Authentication → Sign In / Providers включи Email и Google, затем внеси Google OAuth Client ID и Secret из Google Cloud Console.
- Для VK ID потребуется создать приложение VK ID и настроить отдельный совместимый OAuth/OIDC provider. Кнопка VK пока показывает сообщение и не выполняет вход.
- В Authentication → URL Configuration добавь адрес сайта GitHub Pages в Site URL и Redirect URLs.

Адрес владельца получает роль owner только после регистрации и подтверждения именно этого email. На момент подготовки базы аккаунта с этим адресом ещё не было.
