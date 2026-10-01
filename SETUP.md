# პორტალის დაყენება (Supabase)

პორტალი ანგარიშებსა და სკოლებს Supabase-ში ინახავს. ეს ერთჯერადი დაყენებაა, დაახლოებით 10 წუთი.

## 1. Supabase პროექტი

1. გახსენი https://supabase.com და შექმენი ანგარიში.
2. **New project** → სახელი, მაგ. `school-portal`. რეგიონად აირჩიე **Central EU (Frankfurt)**. ბაზის პაროლი შეინახე.
3. **SQL Editor** → **New query**. ჩასვი ფაილის `supabase/migrations/0001_portal.sql` მთელი შიგთავსი და დააჭირე **Run**.
4. **Authentication → Sign In / Providers**:
   - **Allow new users to sign up** — გამორთე (ანგარიშებს მხოლოდ პორტალი ქმნის);
   - **Confirm email** — გამორთე.

## 2. გასაღებები

**Project Settings → API**-დან ამოიღე სამი მნიშვნელობა და ჩაწერე ფაილში `.env.local` (ნიმუში: `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=...       # service_role / secret key — საიდუმლოა!
NEXT_PUBLIC_SITE_URL=https://anatomy-six-beta.vercel.app
```

იგივე ოთხი მნიშვნელობა ჩაწერე Vercel-შიც: **Project → Settings → Environment Variables** (Production + Preview).

> `SUPABASE_SERVICE_ROLE_KEY` არავის გაუზიარო და GitHub-ზე არ ატვირთო — `.env.local` ამიტომაა `.gitignore`-ში.

## 3. პირველი ადმინისტრატორი (შენ)

```
npx tsx scripts/create-super-admin.ts "შენი სახელი გვარი" admin
```

ბრძანება დაბეჭდავს მომხმარებლის სახელს და დროებით პაროლს. შედი `/login`-ზე — პირველივე შესვლისას საკუთარ პაროლს შექმნი.

## როგორ მუშაობს

- **სკოლა** ავსებს ფორმას `/request`.
- **შენ** (სისტემის ადმინისტრატორი) `/admin`-ზე ადასტურებ — იქმნება სკოლა და მისი ადმინისტრატორის ანგარიში. მონაცემებს (მომხმარებელი + დროებითი პაროლი) გადასცემ საკონტაქტო პირს.
- **სკოლის ადმინისტრატორი** `/school`-ზე ქმნის მასწავლებლებისა და მოსწავლეების ანგარიშებს (მთელი კლასი ერთად, დასაბეჭდი ბარათებით).
- **მასწავლებელს** შეუძლია მოსწავლეების დამატება და მათი პაროლის აღდგენა.
- ყველა ახალი ანგარიში დროებითი პაროლით იწყება, რომელიც პირველ შესვლაზე იცვლება. მოსწავლეებს ელ-ფოსტა არ სჭირდებათ.
