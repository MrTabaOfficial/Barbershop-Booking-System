<h1 align="center">დალაქი</h1>

<p align="center">
  დაჯავშნის სისტემა რამდენიმე დალაქიანი ბარბერშოპისთვის: კლიენტი ჯავშნის და დეპოზიტს იხდის, დალაქი დღეს ტელეფონიდან მართავს, მფლობელი კი მთელ სალონს.
</p>

<p align="center">
  <img alt="TypeScript 7.0" src="https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white">
  <img alt="Node.js 26 ან უფრო ახალი" src="https://img.shields.io/badge/Node.js-26%2B-5FA04E?logo=nodedotjs&logoColor=white">
  <img alt="React 19.3" src="https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black">
  <img alt="Express 5.2" src="https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white">
  <img alt="PostgreSQL 17" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white">
  <img alt="Prisma 7.10" src="https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma&logoColor=white">
  <img alt="Tailwind CSS 4.3" src="https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="MIT ლიცენზია" src="https://img.shields.io/badge/License-MIT-green">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>ქართული</b>
</p>

<p align="center">
  <img src="docs/screenshots/ka/home.jpg" alt="მთავარი გვერდი: სალონის ფასადი ღამით, სათაური, დღევანდელი სამუშაო საათები და დაჯავშნის ღილაკი" width="100%">
</p>

## პროექტის შესახებ

დალაქი არის ვებ-აპლიკაცია თბილისში მდებარე ბარბერშოპისთვის, სადაც სამი დალაქი მუშაობს. კლიენტი ირჩევს სერვისს, დალაქსა და თავისუფალ დროს, იხდის დეპოზიტს და შემდეგ შეუძლია ჯავშნის გადატანა ან გაუქმება. თითოეულ დალაქს აქვს ტელეფონზე მორგებული განრიგის გვერდი, სადაც აღნიშნავს, მოვიდა თუ არა კლიენტი, და თავად ნიშნავს დასვენების დღეებს. მფლობელს აქვს ადმინის ნაწილი სერვისებისთვის, ფასებისთვის, თანამშრომლებისთვის, სამუშაო საათებისთვის, ყველა ჯავშნისთვის და შემოსავლის მაჩვენებლებისთვის. საიტი ინგლისურ და ქართულ ენებზეა.

ეს პროექტი პორტფოლიოსთვის ავაწყვე, რომ მევარჯიშა დაჯავშნის სისტემის იმ ნაწილებზე, სადაც შეცდომის დაშვება ადვილია და შეუმჩნეველი რჩება: ორი ადამიანი ერთსა და იმავე დროს ერთდროულად ჯავშნის; სამუშაო საათები სალონის საათით ინახება, ჯავშნები კი UTC-ში; დეპოზიტი შეიძლება დაგვიანებით გადაიხადონ ან დასაბრუნებელი გახდეს; სესიამ უნდა გაუძლოს მოპარულ token-ს. მინდოდა ერთი პროექტი ბოლომდე მიმეყვანა: სქემა ხელით დაწერილი constraint-ებით, API, რომელიც რეალურ ბაზაზე იტესტება, React კლიენტი UI ბიბლიოთეკის გარეშე და end-to-end ტესტები ბრაუზერში.

> **ეს დემოა.** სალონი გამოგონილია, მონაცემები კი seed სკრიპტიდან მოდის (247 კლიენტი და თორმეტი კვირის ჯავშნები). აპლიკაცია თქვენს კომპიუტერზე ეშვება და არსად არ არის განთავსებული. რეალური ფული არ მოძრაობს და რეალური წერილი არ იგზავნება: Stripe-ის გასაღებების გარეშე checkout-ს ცვლის გვერდი, რომელზეც აშკარად წერია, რომ ყალბია, ყველა წერილს კი ლოკალური საფოსტო ყუთი იჭერს.
>
> რაც დაუსრულებელია ან დაუდასტურებელია: Stripe-ის ინტეგრაცია მხოლოდ Stripe-ის API mock-ზე გაეშვა, რეალურ ანგარიშზე არასდროს; Telegram-შეტყობინებები Telegram-ამდე არასდროს მისულა; არ არის პაროლის აღდგენა და ელფოსტის დადასტურება; წერილები მხოლოდ ინგლისურადაა. სრული სია: [docs/reference.md](docs/reference.md#known-limitations) (ინგლისურად).

## სარჩევი

- [შესაძლებლობები](#შესაძლებლობები)
- [ეკრანები](#ეკრანები)
- [Use case დიაგრამა](#use-case-დიაგრამა)
- [მონაცემთა ბაზა](#მონაცემთა-ბაზა)
- [ტექნოლოგიები](#ტექნოლოგიები)
- [პროექტის სტრუქტურა](#პროექტის-სტრუქტურა)
- [გაშვება](#გაშვება)
- [გვერდები და API](#გვერდები-და-api)
- [უსაფრთხოება](#უსაფრთხოება)
- [გამოყენებული რესურსები](#გამოყენებული-რესურსები)
- [ლიცენზია](#ლიცენზია)

## შესაძლებლობები

**საჯარო საიტი**

- ნახეთ სერვისები ხანგრძლივობითა და ფასით, დალაქები მათი სამუშაო დღეებით, სამუშაო საათები და მისამართი.
- ნახეთ, ღიაა თუ არა სალონი დღეს, სალონის საათის მიხედვით.
- გადართეთ მთელი ინტერფეისი ინგლისურსა და ქართულს შორის; არჩევანი ინახება.

**დაჯავშნა**

- დაჯავშნეთ ოთხ ნაბიჯად: სერვისი, დალაქი, დღე და დრო, დადასტურება. არჩევანი URL-ში ინახება, ამიტომ შუა გზაზე შესვლა ან რეგისტრაცია იმავე ნაბიჯზე გაბრუნებთ.
- გთავაზობთ მხოლოდ ნამდვილად თავისუფალ დროებს: დალაქის სამუშაო საათებში, შესვენებისა და დასვენების დღეების გარეთ, მინიმუმ ერთი საათით და მაქსიმუმ 60 დღით ადრე.
- დასადასტურებლად გადაიხადეთ დეპოზიტი. გადაუხდელი ჯავშანი დროს 30 წუთით იკავებს და მანამდე „ჩემი ჯავშნებიდან“ მისი გადახდა ისევ შეიძლება.
- თუ დრო წამით ადრე სხვამ დაიკავა, ამას შეიტყობთ და დროების ახალ სიას მიიღებთ.

**ანგარიშები**

- დარეგისტრირდით კლიენტად, შედით, დარჩით შესული გვერდის გადატვირთვის შემდეგაც, გამოდით.
- შესვლის შემდეგ ხვდებით თქვენი როლის გვერდზე: „ჩემი ჯავშნები“, დალაქის განრიგი ან ადმინის ნაწილი.

**ჩემი ჯავშნები**

- ნახეთ მომავალი ჯავშნები და წარსული ვიზიტები.
- გადაიტანეთ ჯავშანი სხვა დროზე ან გააუქმეთ. ვიზიტამდე 24 საათით ადრე დეპოზიტი ბრუნდება; ამის შემდეგ რჩება სალონს.
- მიიღეთ წერილი, როცა ჯავშანი დასტურდება, გადადის ან უქმდება, და შეხსენება წინა დღეს.

**დალაქი**

- ნახეთ დღევანდელი ვიზიტები და ნებისმიერი კვირა, ტელეფონზე მორგებული განლაგებით.
- აღნიშნეთ თითოეული ვიზიტი როგორც შესრულებული ან გამოუცხადებელი და შეასწორეთ, თუ შემთხვევით სხვას დააჭირეთ.
- დაურეკეთ კლიენტს პირდაპირ სიიდან.
- დაამატეთ და წაშალეთ დასვენების დღეები. დღე, რომელზეც უკვე არის ჯავშნები, არ მიიღება და ხელისშემშლელი ჯავშნები ჩამოითვლება.

**ადმინი**

- ნახეთ შემოსავალი, ჯავშნები, გამოუცხადებლობის წილი და გაუქმებები ნებისმიერი პერიოდისთვის, დიაგრამებით დღეების ან კვირების მიხედვით, ჯავშნები სტატუსის მიხედვით და ყველაზე მოთხოვნადი სერვისები. თითოეულ დიაგრამას აქვს ცხრილის ხედიც.
- გაფილტრეთ, დაალაგეთ და გვერდებად გადაათვალიერეთ ყველა ჯავშანი; მოძებნეთ კლიენტით; გააუქმეთ ნებისმიერი ჯავშანი დეპოზიტის დაბრუნებით ან მის გარეშე; გაფილტრული სია Excel-ში გაიტანეთ.
- დაამატეთ, შეცვალეთ და გამორთეთ სერვისები, მათი ფასით, დეპოზიტითა და ხანგრძლივობით.
- დაამატეთ დალაქის ანგარიშები, შეცვალეთ ისინი, დააყენეთ თითოეული კვირის დღის საათები და შესვენება, გამორთეთ.

**კულისებში**

- გადაუხდელი ჯავშნების ვადის ამოწურვა, შეხსენებების გაგზავნა და ძველი refresh token-ების წაშლა დაგეგმილი job-ებით ხდება.
- მფლობელი იღებს შეტყობინებას თითოეულ ახალ ჯავშანსა და გაუქმებაზე და შეჯამებას სალონის დახურვისას (თუ Telegram bot არ არის გამართული, ეს სერვერის log-ში იწერება).

## ეკრანები

ყველა გადაღებულია გაშვებული აპლიკაციიდან, დემო მონაცემებით. იგივე ეკრანები ინგლისურად: [ინგლისური README](README.md#screenshots).

| მთავარი | სერვისები, დალაქები და საათები |
| --- | --- |
| ![მთავარი გვერდის ზედა ნაწილი](docs/screenshots/ka/home.jpg) | ![ფასების სია სალონის ფოტოს გვერდით](docs/screenshots/ka/home-wall.jpg) |

| 1. სერვისის არჩევა | 2. დალაქის არჩევა |
| --- | --- |
| ![ხუთი სერვისი ფასითა და ხანგრძლივობით](docs/screenshots/ka/book-service.png) | ![სამი დალაქი თავისი სამუშაო დღეებით](docs/screenshots/ka/book-barber.png) |

| 3. დღისა და დროის არჩევა | 4. დადასტურება |
| --- | --- |
| ![კვირის დღეები და თავისუფალი დროები, შესვენება მონიშნულია](docs/screenshots/ka/book-time.png) | ![დეპოზიტი, გაუქმების ბოლო ვადა და ჯავშნის შეჯამება](docs/screenshots/ka/book-confirm.png) |

| გადახდის გვერდი (დემო პროვაიდერი) | ჩემი ჯავშნები |
| --- | --- |
| ![ყალბი გადახდის გვერდი, რომელიც Stripe Checkout-ს ცვლის; მხოლოდ ინგლისურადაა](docs/screenshots/payment.png) | ![მომავალი ჯავშნები გადატანისა და გაუქმების ღილაკებით, ქვემოთ წარსული ვიზიტები](docs/screenshots/ka/my-bookings.png) |

| ჯავშნის გადატანა | დადასტურების წერილი |
| --- | --- |
| ![დიალოგი დღის ასარჩევით და თავისუფალი დროებით; მიმდინარე დრო მონიშნულია](docs/screenshots/ka/move-booking.png) | ![დადასტურების წერილი Mailpit-ში; წერილები მხოლოდ ინგლისურადაა](docs/screenshots/email.png) |

| შესვლა | რეგისტრაცია |
| --- | --- |
| ![შესვლის ფორმა](docs/screenshots/ka/login.png) | ![რეგისტრაციის ფორმა](docs/screenshots/ka/register.png) |

| დალაქი: განრიგი | ადმინი: მიმოხილვა |
| --- | --- |
| ![დღევანდელი ვიზიტები, კვირა ერთი გახსნილი დღით და „შესრულდა / არ მოვიდა“ გადამრთველი](docs/screenshots/ka/barber.png) | ![შემოსავალი, ჯავშნები, გამოუცხადებლობა და ოთხი დიაგრამა ბოლო 30 დღისთვის](docs/screenshots/ka/admin-overview.png) |

| ადმინი: ჯავშნები | ადმინი: სერვისები |
| --- | --- |
| ![ჯავშნების ცხრილი ფილტრებით, ძიებითა და Excel-ში ექსპორტით](docs/screenshots/ka/admin-bookings.png) | ![სერვისები ფასით, დეპოზიტითა და ხანგრძლივობით](docs/screenshots/ka/admin-services.png) |

| ადმინი: თანამშრომლები | ადმინი: სამუშაო საათები |
| --- | --- |
| ![დალაქები სამუშაო დღეებითა და ბიოგრაფიით](docs/screenshots/ka/admin-staff.png) | ![დიალოგი თითოეული კვირის დღის საათებითა და შესვენებით](docs/screenshots/ka/admin-hours.png) |

ტელეფონზე:

<p align="center">
  <img src="docs/screenshots/ka/home-phone.jpg" alt="მთავარი გვერდი ტელეფონის სიგანეზე" width="270">
  &nbsp;&nbsp;
  <img src="docs/screenshots/ka/barber-phone.png" alt="დალაქის განრიგი ტელეფონის სიგანეზე" width="270">
</p>

სერვისების სახელები, დალაქების ბიოგრაფიები და კლიენტების სახელები ბაზიდან მოდის და დემო მონაცემებში ინგლისურად წერია, ამიტომ ქართულ ეკრანებზეც ასე ჩანს.

## Use case დიაგრამა

```mermaid
flowchart LR
  visitor(["ვიზიტორი"])
  customer(["კლიენტი"])
  barber(["დალაქი"])
  admin(["ადმინი"])
  provider(["გადახდის პროვაიდერი"])
  scheduler(["Scheduler"])

  subgraph system["დალაქის დაჯავშნის სისტემა"]
    direction TB
    browse("სერვისების, დალაქებისა და საათების ნახვა")
    times("თავისუფალი დროების ნახვა")
    account("რეგისტრაცია და შესვლა")
    book("დროის დაჯავშნა და დეპოზიტის გადახდა")
    change("ჯავშნის გადატანა ან გაუქმება")
    schedule("საკუთარი განრიგის ნახვა")
    outcome("ვიზიტის აღნიშვნა: შესრულდა ან არ მოვიდა")
    daysoff("საკუთარი დასვენების დღეების მართვა")
    catalog("სერვისებისა და ფასების მართვა")
    staff("დალაქებისა და სამუშაო საათების მართვა")
    bookings("ჯავშნების ძიება, გაუქმება და ექსპორტი")
    stats("შემოსავლისა და ჯავშნების სტატისტიკა")
    confirm("გადახდილი ჯავშნის დადასტურება")
    jobs("გადაუხდელი ჯავშნების ვადის ამოწურვა, შეხსენებები და დღის შეჯამება")
  end

  visitor --> browse
  visitor --> times
  visitor --> account
  customer --> book
  customer --> change
  barber --> schedule
  barber --> outcome
  barber --> daysoff
  admin --> catalog
  admin --> staff
  admin --> bookings
  admin --> stats
  provider --> confirm
  scheduler --> jobs
```

კლიენტს შეუძლია ყველაფერი, რაც ვიზიტორს. დალაქები და ადმინი იმავე ფორმით შედიან, რომლითაც კლიენტები.

## მონაცემთა ბაზა

```mermaid
erDiagram
  users ||--o| barbers : "შეიძლება იყოს"
  users ||--o{ refresh_tokens : "აქვს"
  users ||--o{ bookings : "ჯავშნის"
  barbers ||--o{ working_hours : "მუშაობს"
  barbers ||--o{ days_off : "ისვენებს"
  barbers ||--o{ bookings : "ემსახურება"
  services ||--o{ bookings : "იჯავშნება"

  users {
    text id PK
    text email UK
    text password_hash
    text name
    text phone "არასავალდებულო"
    role role "CUSTOMER, BARBER ან ADMIN"
    timestamptz created_at
    timestamptz updated_at
  }
  refresh_tokens {
    text id PK
    text user_id FK
    text token_hash UK "token-ის SHA-256"
    timestamptz expires_at
    timestamptz revoked_at "არასავალდებულო"
    timestamptz created_at
  }
  barbers {
    text id PK
    text user_id FK "უნიკალური"
    text bio "არასავალდებულო"
    boolean is_active
  }
  services {
    text id PK
    text name UK
    text description "არასავალდებულო"
    int duration_minutes
    int price_cents
    int deposit_cents
    boolean is_active
  }
  working_hours {
    text id PK
    text barber_id FK
    int weekday "0 კვირაა; ერთი ჩანაწერი დალაქსა და კვირის დღეზე"
    int start_minute "წუთები შუაღამიდან, სალონის საათით"
    int end_minute
    int break_start_minute "არასავალდებულო"
    int break_end_minute "არასავალდებულო"
  }
  days_off {
    text id PK
    text barber_id FK
    date date "სალონის კალენდარული თარიღი; ერთი ჩანაწერი დალაქსა და თარიღზე"
    text reason "არასავალდებულო"
  }
  bookings {
    text id PK
    text customer_id FK
    text barber_id FK
    text service_id FK
    timestamptz starts_at "UTC მომენტი"
    timestamptz ends_at
    booking_status status "PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW ან EXPIRED"
    int price_cents "კოპირდება სერვისიდან დაჯავშნისას"
    int deposit_cents
    timestamptz cancelled_at "არასავალდებულო"
    boolean cancelled_in_free_window "არასავალდებულო"
    payment_status payment_status "UNPAID, PAID, REFUNDED ან REFUND_FAILED"
    text payment_session_id UK "არასავალდებულო"
    text payment_url "არასავალდებულო"
    text payment_id "არასავალდებულო"
    text payment_provider "არასავალდებულო"
    timestamptz hold_expires_at "არასავალდებულო"
    timestamptz reminder_sent_at "არასავალდებულო"
    timestamptz created_at
    timestamptz updated_at
  }
  daily_summaries {
    date date PK
    timestamptz sent_at
  }
```

მომხმარებელი ან კლიენტია, ან ერთ დალაქის ჩანაწერს უკავშირდება, ან ადმინია; ჯავშანი აერთიანებს ერთ კლიენტს, ერთ დალაქსა და ერთ სერვისს, დალაქს კი აქვს თითო სამუშაო საათების ჩანაწერი კვირის დღეზე და ნებისმიერი რაოდენობის დასვენების დღე. `daily_summaries` ცალკე დგას: ჩანაწერი აღნიშნავს, რომ მფლობელის შეჯამება ამ თარიღისთვის გაიგზავნა. id-ები ტექსტად შენახული UUID-ებია.

ერთი წესი ხელით დაწერილ migration-შია, რადგან Prisma მას ვერ გამოხატავს: exclusion constraint `bookings` ცხრილზე, რომელიც უარყოფს ერთი დალაქის ორ ჯავშანს, თუ მათი დროები ერთმანეთს ფარავს (გაუქმებული და ვადაგასული არ ითვლება) ([პირველი migration](server/prisma/migrations/20261004143447_booking_no_overlap/migration.sql), [მეორე](server/prisma/migrations/20261004183146_booking_overlap_ignores_expired/migration.sql)). სწორედ ეს აჩერებს ორმაგ დაჯავშნას, როცა ორი request ერთდროულად მოდის; ახსნა: [docs/reference.md](docs/reference.md#how-double-booking-is-prevented) (ინგლისურად).

## ტექნოლოგიები

| ფენა | ტექნოლოგია |
| --- | --- |
| ენა | TypeScript 7 ორივე მხარეს, სერვერზე tsx-ით ეშვება |
| საიტი | React 19, React Router 8, TanStack Query 5, react-hook-form zod-ით |
| სტილები | Tailwind CSS 4; კომპონენტები და დიაგრამები ამ პროექტისთვისაა დაწერილი, UI ბიბლიოთეკის გარეშე |
| Build | Vite 8 |
| API | Node.js 26, Express 5, ვალიდაციისთვის zod |
| მონაცემთა ბაზა | PostgreSQL 17 Docker-ში, ORM-ად Prisma 7, საჭირო ადგილებში ხელით დაწერილი SQL migration-ები |
| ავტორიზაცია | JWT access token-ები (jose), მბრუნავი refresh token-ები httpOnly cookie-ში, bcrypt-ით დაჰეშილი პაროლები |
| გადახდები | Stripe Checkout სატესტო რეჟიმში, ან ჩაშენებული ყალბი პროვაიდერი |
| წერილები და შეტყობინებები | Nodemailer, ლოკალურად Mailpit იჭერს; მფლობელის შეტყობინებებისთვის Telegraf |
| დაგეგმილი job-ები | node-cron |
| Excel-ექსპორტი | write-excel-file |
| ენები | ჩემი პატარა ლექსიკონის მოდული, i18n ბიბლიოთეკის გარეშე |
| ტესტები | API-სთვის Vitest და supertest, კლიენტისთვის Vitest, end-to-end-ისთვის Playwright |

## პროექტის სტრუქტურა

```
.
├── .env.example                # ყველა პარამეტრი ინსტრუქციებით; კოპირდება .env-ში
├── docker-compose.yml          # PostgreSQL და Mailpit
├── docs/
│   ├── reference.md            # როგორ მუშაობს გადახდები, ავტორიზაცია, თავისუფალი დროები და job-ები
│   └── screenshots/            # ამ README-ს სურათები (ka/ ქართულ ეკრანებს შეიცავს)
├── server/                     # API
│   ├── prisma/
│   │   ├── schema.prisma       # მონაცემთა მოდელი
│   │   ├── migrations/         # რიგით გაშვებული SQL, ორი მათგანი ხელითაა დაწერილი
│   │   └── seed.ts             # დემო მონაცემები: 3 დალაქი, 5 სერვისი, 247 კლიენტი, 12 კვირა
│   ├── src/
│   │   ├── index.ts            # უშვებს სერვერს და დაგეგმილ job-ებს
│   │   ├── app.ts              # აწყობს Express აპს და ამაგრებს router-ებს
│   │   ├── env.ts              # კითხულობს და ამოწმებს environment-ს
│   │   ├── db.ts               # Prisma client, UTC-ზე დაფიქსირებული
│   │   ├── errors.ts           # AppError და შეცდომის ერთიანი ფორმატი
│   │   ├── dependencies.ts     # გადახდები, mailer და შეტყობინებები, ტესტებში ჩანაცვლებადი
│   │   ├── auth/               # რეგისტრაცია, შესვლა, refresh token-ის როტაცია, როლების middleware
│   │   ├── shop/               # სალონის მონაცემები და სალონის საათის UTC-ში გადაყვანა
│   │   ├── services/           # GET /services
│   │   ├── barbers/            # GET /barbers
│   │   ├── availability/       # თავისუფალი დროების გამოთვლა (წმინდა ფუნქცია) და მისი route
│   │   ├── bookings/           # შექმნა, სია, გაუქმება, გადატანა; წესები და სტატუსები
│   │   ├── payments/           # პროვაიდერის ინტერფეისი, Stripe და ყალბი პროვაიდერი, webhook
│   │   ├── notifications/      # წერილების შაბლონები, mailer, მფლობელის შეტყობინებები
│   │   ├── jobs/               # ვადის ამოწურვა, შეხსენებები, დღის შეჯამება, token-ების გასუფთავება
│   │   ├── barber/             # დალაქის განრიგი, ვიზიტის შედეგები და დასვენების დღეები
│   │   └── admin/              # სერვისები, თანამშრომლები, ჯავშნები, სტატისტიკა, Excel-ექსპორტი
│   └── tests/                  # API ტესტები, რეალურ PostgreSQL ბაზაზე
├── client/                     # საიტი
│   ├── index.html
│   ├── vite.config.ts          # Vite, Tailwind და /api proxy სერვერისკენ
│   ├── public/photos/          # მთავარი გვერდის ფოტოები
│   └── src/
│       ├── main.tsx            # provider-ები და router
│       ├── routes.tsx          # route-ების ცხრილი
│       ├── index.css           # დიზაინის token-ები და საბაზო სტილები
│       ├── api/                # fetch wrapper (token, refresh, retry) და query hook-ები
│       ├── auth/               # სესიის მდგომარეობა, ფორმები, route guard
│       ├── i18n/               # ინგლისური და ქართული ლექსიკონები და t() ფუნქცია
│       ├── components/         # Button, Input, Dialog, Tag, Segmented, Layout და სხვა
│       ├── pages/              # მთავარი, დაჯავშნა, შესვლა, რეგისტრაცია, ჩემი ჯავშნები, დალაქი
│       ├── booking/            # ნაბიჯები, დროის ასარჩევი, შეჯამება, გაუქმებისა და გადატანის დიალოგები
│       ├── barber/             # ვიზიტის სტრიქონი, დღის განრიგი, დასვენების დღეები
│       ├── admin/              # ადმინის ოთხი გვერდი, დიაგრამები და მათი არითმეტიკა
│       ├── lib/                # თარიღები, ფორმატირება, ფორმის შეცდომები, უსაფრთხო redirect-ები
│       └── fonts/              # Literata
└── e2e/                        # Playwright ტესტები, რომლებიც საიტს ბრაუზერში მართავს
    ├── playwright.config.ts    # უშვებს საკუთარ API-სა და საიტს
    ├── global-setup.ts         # მიგრაციას უკეთებს და ავსებს საკუთარ ბაზას
    └── tests/                  # დაჯავშნის, დალაქისა და ადმინის სცენარები
```

## გაშვება

**რა გჭირდებათ:** Node.js 26 ან უფრო ახალი (დროის სარტყლების კოდი ჩაშენებულ `Temporal`-ს იყენებს), Docker Compose-ით (Docker Desktop საკმარისია) და Git. ქვემოთ მოცემული ნაბიჯები ახალ clone-ზე გავუშვი, Windows 11-ზე Git Bash-ში, Node 26.7-ითა და Docker 29.8-ით.

1. დააკლონირეთ რეპოზიტორია და შედით მასში.

   ```sh
   git clone https://github.com/MrTabaOfficial/Barbershop-Booking-System.git
   cd Barbershop-Booking-System
   ```

2. შექმენით environment ფაილი. ნაგულისხმევი მნიშვნელობები ლოკალური გაშვებისთვის ისედაც გამოდგება.

   ```sh
   cp .env.example .env
   ```

   Windows-ის command prompt-ში ამის ნაცვლად გამოიყენეთ `copy .env.example .env`.

3. გაუშვით PostgreSQL და Mailpit. Compose თავად ქმნის `barbershop` ბაზას.

   ```sh
   docker compose up -d
   ```

4. დააყენეთ API-ს პაკეტები, შექმენით ცხრილები და ჩატვირთეთ დემო მონაცემები.

   ```sh
   cd server
   npm install
   npm run db:migrate
   npm run db:seed
   ```

5. დააყენეთ საიტის პაკეტები.

   ```sh
   cd ../client
   npm install
   ```

6. ერთ ტერმინალში გაუშვით API.

   ```sh
   cd server
   npm run dev
   ```

7. მეორე ტერმინალში გაუშვით საიტი.

   ```sh
   cd client
   npm run dev
   ```

8. გახსენით http://localhost:5173. აპლიკაციის გაგზავნილი წერილები ჩანს მისამართზე http://localhost:8025.

თუ რომელიმე პორტი დაკავებულია, `.env`-ში შეცვალეთ `PORT` (API), `POSTGRES_PORT` `DATABASE_URL`-ში მითითებულ პორტთან ერთად, `SMTP_PORT` ან `MAILPIT_UI_PORT`. საიტისთვის გაუშვით `npm run dev -- --port 5274` და `.env`-ში `APP_URL` იმავე მისამართზე დააყენეთ.

### პირველი შესვლა

seed ქმნის ამ ანგარიშებს. ყველას პაროლია `demo-password` (`.env`-ში `SEED_PASSWORD`-ის მნიშვნელობა).

| როლი | სახელი | ელფოსტა | სად ხვდება |
| --- | --- | --- | --- |
| ადმინი | Tamar Beridze | tamar@dalaki.example | `/admin` |
| დალაქი | Giorgi Kapanadze | giorgi@dalaki.example | `/barber` |
| დალაქი | Luka Gelashvili | luka@dalaki.example | `/barber` |
| დალაქი | Nika Tsiklauri | nika@dalaki.example | `/barber` |
| კლიენტი | Davit Maisuradze | davit@dalaki.example | `/bookings`, ბევრი წარსული ვიზიტით |
| კლიენტი | Nino Lomidze | nino@dalaki.example | `/bookings` |
| კლიენტი | Irakli Mchedlishvili | irakli@dalaki.example | `/bookings` |

შეგიძლიათ საიტზე ახალი კლიენტიც დაარეგისტრიროთ. დეპოზიტის გადასახდელად ყალბ გადახდის გვერდზე დააჭირეთ „Pay the deposit“-ს; ბარათი არ არის საჭირო.

### ტესტები

თითოეულ კომპლექტს მხოლოდ მე-3 ნაბიჯის კონტეინერები სჭირდება და არცერთი არ ეხება სამუშაო ბაზას.

```sh
cd server
npm test        # API ტესტები საკუთარ barbershop_test ბაზაზე
```

```sh
cd client
npm test        # unit ტესტები, ბრაუზერისა და ბაზის გარეშე
```

```sh
cd e2e
npm install
npm run browsers   # ერთხელ: ჩამოტვირთავს Chromium-ს, რომელსაც Playwright მართავს
npm test           # ავსებს barbershop_e2e ბაზას, უშვებს საკუთარ API-სა და საიტს, ასრულებს და აჩერებს
```

გასაჩერებლად: `docker compose down` კონტეინერებს აჩერებს, `docker compose down -v` კი ბაზასაც შლის.

## გვერდები და API

საიტის გვერდები:

| მისამართი | ვისთვის | რა არის |
| --- | --- | --- |
| `/` | ყველასთვის | მთავარი: სერვისები, დალაქები, საათები, მისამართი |
| `/book` | ყველასთვის; შესვლა ბოლო ნაბიჯზე მოითხოვება | დაჯავშნის ოთხი ნაბიჯი, query string-ში შენახული |
| `/login`, `/register` | ყველასთვის | შესვლა, კლიენტის ანგარიშის შექმნა |
| `/bookings` | შესული მომხმარებელი | ჩემი ჯავშნები |
| `/barber` | დალაქი | განრიგი და დასვენების დღეები |
| `/admin` | ადმინი | მიმოხილვა |
| `/admin/bookings`, `/admin/services`, `/admin/staff` | ადმინი | ადმინის დანარჩენი სამი გვერდი |

API. ბრაუზერში ყველა მისამართი `/api`-ის უკანაა, რომელსაც Vite სერვერი API-ს გადასცემს და პრეფიქსს აშორებს. ყველა შეცდომას აქვს ფორმა `{ "error": { "code", "message", "details" } }`.

| მეთოდი | მისამართი | წვდომა | დანიშნულება |
| --- | --- | --- | --- |
| POST | `/auth/register` | საჯარო | კლიენტის ანგარიშის შექმნა და შესვლა |
| POST | `/auth/login` | საჯარო, rate limit-ით | აბრუნებს access token-ს და აყენებს refresh cookie-ს |
| POST | `/auth/refresh` | refresh cookie | refresh cookie-ს ახალ სესიაზე ცვლის |
| POST | `/auth/logout` | refresh cookie | აუქმებს refresh token-ს და შლის cookie-ს |
| GET | `/auth/me` | შესული | მიმდინარე მომხმარებელი |
| GET | `/shop` | საჯარო | დროის სარტყელი, დღევანდელი თარიღი, დაჯავშნის ზღვრები, მისამართი, ტელეფონი |
| GET | `/services` | საჯარო | აქტიური სერვისები |
| GET | `/barbers` | საჯარო | აქტიური დალაქები საათებითა და შესვენებებით |
| GET | `/availability` | საჯარო | თავისუფალი დროები დალაქის, სერვისისა და თარიღისთვის |
| POST | `/bookings` | შესული | იკავებს დროს და აბრუნებს გადახდის გვერდის მისამართს |
| GET | `/bookings/mine` | შესული | მომხმარებლის მომავალი და წარსული ჯავშნები |
| POST | `/bookings/:id/cancel` | შესული, საკუთარი ჯავშანი | გაუქმება; 24 საათით ან უფრო ადრე დეპოზიტი ბრუნდება |
| POST | `/bookings/:id/reschedule` | შესული, საკუთარი ჯავშანი | დადასტურებული ჯავშნის გადატანა, ვიზიტამდე 24 საათით ადრე |
| POST | `/payments/webhook` | გადახდის პროვაიდერი, ხელმოწერით | ადასტურებს ჯავშანს ან ვადას უწურავს |
| GET, POST | `/payments/fake-checkout/:sessionId` | ნებისმიერი, ვისაც ბმული აქვს | დემო გადახდის გვერდი და მისი „გადახდა“ |
| GET | `/barber/schedule` | დალაქი | დღეები საათებით, დასვენების დღით და ჯავშნებით |
| POST | `/barber/bookings/:id/complete` | დალაქი, საკუთარი ჯავშანი | შესრულებულად აღნიშვნა |
| POST | `/barber/bookings/:id/no-show` | დალაქი, საკუთარი ჯავშანი | გამოუცხადებლად აღნიშვნა |
| GET, POST | `/barber/days-off` | დალაქი | დასვენების დღეების სია და დამატება |
| DELETE | `/barber/days-off/:id` | დალაქი, საკუთარი დღე | დასვენების დღის წაშლა |
| GET, POST | `/admin/services` | ადმინი | ყველა სერვისის სია, ახლის შექმნა |
| PATCH | `/admin/services/:id` | ადმინი | რედაქტირება, ჩართვა ან გამორთვა |
| GET, POST | `/admin/barbers` | ადმინი | ყველა დალაქის სია, დალაქის ანგარიშის შექმნა |
| PATCH | `/admin/barbers/:id` | ადმინი | რედაქტირება, ჩართვა ან გამორთვა |
| PUT | `/admin/barbers/:id/working-hours` | ადმინი | დალაქის კვირის საათებისა და შესვენებების ჩანაცვლება |
| GET | `/admin/bookings` | ადმინი | გაფილტრული, დალაგებული და გვერდებად დაყოფილი ჯავშნები |
| GET | `/admin/bookings/export.xlsx` | ადმინი | იგივე ფილტრები, Excel ფაილად |
| POST | `/admin/bookings/:id/cancel` | ადმინი | ნებისმიერი ჯავშნის გაუქმება, დეპოზიტის დაბრუნებით ან მის გარეშე |
| GET | `/admin/overview` | ადმინი | სტატისტიკა თარიღების შუალედისთვის |

query პარამეტრები და თითოეული endpoint-ის დეტალები: [docs/reference.md](docs/reference.md#api) (ინგლისურად).

## უსაფრთხოება

რას აკეთებს კოდი:

- პაროლები bcrypt-ით იჰეშება (cost 10) და 8-დან 72 სიმბოლომდე უნდა იყოს. უცნობი ელფოსტით შესვლა ცრუ hash-თან მოწმდება, ამიტომ იმდენივე დრო სჭირდება, რამდენიც ნამდვილს.
- access token-ები HS256-ით ხელმოწერილი JWT-ებია და 15 წუთი მოქმედებს. სერვერი არ ეშვება, თუ ხელმოწერის secret 32 სიმბოლოზე მოკლეა.
- refresh token-ები 32 შემთხვევითი ბაიტია, ინახება მხოლოდ SHA-256 hash-ად და ყოველ გამოყენებაზე იცვლება. უკვე გამოყენებული token-ის წარდგენა ამ მომხმარებლის ყველა სესიას ასრულებს.
- refresh cookie არის `httpOnly`, `SameSite=Strict`, შეზღუდულია `/auth` მისამართით და `Secure`-ია, როცა `NODE_ENV` არის `production`.
- ბრაუზერში access token ცვლადში ინახება, `localStorage`-ში არასდროს.
- წარუმატებელი შესვლები შეზღუდულია: 10 მცდელობა 15 წუთში ერთი IP მისამართიდან.
- როლები სერვერზე მოწმდება `/barber`-ისა და `/admin`-ის ყოველ request-ზე. დალაქი, რომელიც სხვა დალაქის ჯავშანს ან დასვენების დღეს ითხოვს, 404-ს იღებს. რეგისტრაციის endpoint-ზე გაგზავნილი `role` იგნორირდება.
- request-ის ყველა შემავალი მონაცემი zod-ით მოწმდება. ბაზასთან მუშაობა Prisma-ს გავლით ხდება, ხელით დაწერილი SQL კი პარამეტრიზებულ tagged template-ებს იყენებს.
- ორმაგ დაჯავშნას ბაზის constraint უარყოფს და არა მხოლოდ კოდში გაკეთებული შემოწმება.
- გადახდის webhook-ები request-ის დაუმუშავებელ body-ზე პროვაიდერის ხელმოწერით მოწმდება, ერთი და იმავე event-ის ორჯერ გამოყენება კი არაფერს ცვლის.
- შესვლის შემდეგ `?next=` მისამართზე გადასვლა მხოლოდ მაშინ ხდება, როცა ის საიტის შიდა მისამართია.
- მოულოდნელი შეცდომები ზოგად შეტყობინებას აბრუნებს; დეტალები სერვერის log-ში იწერება.
- Docker Compose-ში ბაზა და საფოსტო ყუთი მხოლოდ `127.0.0.1`-ზე უსმენს.

რა უნდა შეიცვალოს ინტერნეტში განთავსებამდე:

- შეცვალეთ `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` და `SEED_PASSWORD`, და არ ჩატვირთოთ დემო ანგარიშები.
- დააყენეთ `NODE_ENV=production` და გამოიყენეთ HTTPS, რომ refresh cookie `Secure`-ად მოინიშნოს.
- მიუთითეთ Stripe-ის ნამდვილი გასაღებები. მათ გარეშე ყალბი გადახდის გვერდი აქტიურია და ნებისმიერს, ვისაც მისი ბმული აქვს, შეუძლია ჯავშანი გადახდილად მონიშნოს.
- წინ დააყენეთ reverse proxy, რომელიც საიტს გასცემს და `/api`-ს გადაამისამართებს; ეს proxy დღეს მხოლოდ Vite-ის dev და preview სერვერებშია. შემდეგ დააყენეთ Express-ის `trust proxy`, თორემ შესვლის ლიმიტი proxy-ს მისამართს დაითვლის.
- დაამატეთ security header-ები (მაგალითად, helmet-ით) და content security policy; ახლა არცერთი არ არის.
- დაამატეთ rate limit რეგისტრაციასა და დაჯავშნაზე; ახლა მხოლოდ შესვლას აქვს და ისიც მეხსიერებაში ინახება.
- დაამატეთ ელფოსტის დადასტურება და პაროლის აღდგენა; არცერთი არ არსებობს.

## გამოყენებული რესურსები

ბიბლიოთეკები, ყველა npm-იდან:

| ბიბლიოთეკა | რისთვის | ლიცენზია |
| --- | --- | --- |
| React, React DOM, React Router | საიტი | MIT |
| TanStack Query | სერვერის მონაცემების ჩატვირთვა და cache | MIT |
| react-hook-form, @hookform/resolvers | ფორმები | MIT |
| zod | ვალიდაცია ორივე მხარეს | MIT |
| Tailwind CSS, Vite, @vitejs/plugin-react | სტილები და build | MIT |
| Express, cookie-parser, express-rate-limit | API | MIT |
| Prisma (client, CLI, pg adapter) | ბაზასთან მუშაობა და migration-ები | Apache-2.0 |
| jose | JWT-ების ხელმოწერა და შემოწმება | MIT |
| bcryptjs | პაროლების hash | BSD-3-Clause |
| stripe | Stripe Checkout და webhook-ები | MIT |
| Nodemailer | წერილების გაგზავნა | MIT-0 |
| Telegraf | Telegram-შეტყობინებები | MIT |
| node-cron | დაგეგმილი job-ები | ISC |
| write-excel-file, read-excel-file | Excel-ექსპორტი და მისი წაკითხვა ტესტებში | MIT |
| tsx, Vitest, supertest | სერვერის გაშვება და ტესტირება | MIT |
| Playwright | end-to-end ტესტები | Apache-2.0 |
| TypeScript | ენა | Apache-2.0 |

ფონტები:

- [Literata](https://github.com/googlefonts/literata), ავტორი TypeTogether, SIL Open Font License 1.1. `client/src/fonts`-ის ფაილები Google Fonts-იდანაა.
- [FiraGO](https://bboxtype.com/typefaces/FiraGO/), ავტორი bBox Type, SIL Open Font License 1.1, `@fontsource/firago` პაკეტით. მისით იხატება ქართული ინტერფეისი, ლოგო და ლარის ნიშანი.

Docker image-ები: `postgres:17-alpine` და `axllent/mailpit`.

ფოტოები, ყველა უფასოდ გამოსაყენებელია [Pexels License](https://www.pexels.com/license/)-ით ან [Unsplash License](https://unsplash.com/license)-ით (შემოწმდა თითოეული ფოტოს გვერდზე 2026 წლის 6 ოქტომბერს). მათზე სხვა ბარბერშოპებია და არა თბილისური სალონი. 1600 px-მდე დავაპატარავე და WebP-ად შევინახე; სალონის ფასადის ფოტო ზემოდანაც არის მოჭრილი.

| ფაილი `client/public/photos`-ში | ფოტოგრაფი | წყარო |
| --- | --- | --- |
| `window-night.webp` | Mikael Buchholtz | [Pexels](https://www.pexels.com/photo/store-entrance-in-town-at-night-15445264/) |
| `interior.webp` | Wal_ | [Pexels](https://www.pexels.com/photo/vintage-barber-shop-interior-with-classic-chairs-37764947/) |
| `fade.webp` | Antoni Shkraba | [Pexels](https://www.pexels.com/photo/man-getting-a-haircut-4625626/) |
| `chair.webp` | Antoni Shkraba | [Pexels](https://www.pexels.com/photo/a-man-in-barber-shop-4625632/) |
| `barber.webp` | Antoni Shkraba | [Pexels](https://www.pexels.com/photo/man-giving-his-customer-a-haircut-4625631/) |
| `scissors.webp` | Renan Rezende | [Pexels](https://www.pexels.com/photo/barber-cutting-hair-5584458/) |
| `finished.webp` | Brian Silva | [Pexels](https://www.pexels.com/photo/barber-perfecting-a-fade-haircut-close-up-39559270/) |
| `tools.webp` | dwi rina | [Unsplash](https://unsplash.com/photos/black-framed-eyeglasses-beside-black-pen-sjjvyTFsnW8) |
| `shave.webp` | Mitchell Orr | [Unsplash](https://unsplash.com/photos/a-man-getting-his-hair-cut-by-a-barber-iDbTDUzQTxY) |
| `bulbs.webp` | Ashkan Forouzani | [Unsplash](https://unsplash.com/photos/filament-bulbs-turned-on-d0kvBZZsMMw) |

icon-ების ნაკრები ან template არ გამომიყენებია: favicon და დიაგრამები ამ პროექტშია დახატული.

## ლიცენზია

[MIT](LICENSE) © 2026 MrTabaOfficial. ფოტოებსა და ფონტებს საკუთარი ლიცენზიები აქვს, რომლებიც ზემოთაა ჩამოთვლილი.
