# Docházka

Cloudflare Pages Functions s D1 bindingem `DB`.

## První nastavení administrace

V nastavení **Production** v Cloudflare Pages nastavte **Variables and secrets**:
- typ: **Secret**
- název: `ADMIN_SETUP_KEY`
- hodnota: vlastní náhodný jednorázový kód alespoň o 20 znacích. Nepatří do repozitáře ani chatu.

Po nasazení otevřete `/admin`. Správce `thortyy` zadá jednorázový kód a nastaví si vlastní heslo (12–128 znaků). Kód funguje jen před založením správce; potom jej můžete z Cloudflare odstranit.

Správce vytvoří na stránce pozvánku pro učitele a soukromě mu předá odkaz. Pozvánka platí 24 hodin a je jednorázová. Učitel si zvolí vlastní přihlašovací jméno a heslo. Oba mohou spouštět hodiny a sledovat docházku. Pozvánky vytváří pouze správce.

Přihlášení trvá 12 hodin, cookie je HttpOnly, Secure a SameSite=Strict. Hesla se ukládají jako PBKDF2-SHA256 (100 000 iterací, samostatná náhodná sůl); session tokeny a pozvánky pouze jako SHA-256 hashe. Zápisy do administrace ověřují Origin. Přihlašování a založení účtů mají limit 20 pokusů za 15minutové okno na IP adresu. Při sdílené školní IP může limit dočasně omezit více uživatelů.

Nové tabulky se vytvoří automaticky; existující docházka zůstává. Preview sdílející produkční D1 sdílí také účty a pozvánky. V testovacím náhledu nespouštějte hodinu a nevytvářejte účty, pokud nechcete ovlivnit produkční databázi. Pro oddělené testování použijte samostatnou D1 databázi.

## Testy

Node.js 24 nebo novější:

```sh
node --test tests/auth.test.mjs
```

## Přehled a minihry

Učitelský přehled obsahuje počty přítomných a chybějících, ukazatel přítomnosti, vyhledávání bez diakritiky, filtry, kopírování kódu a export celé aktuální docházky do CSV (UTF-8 s BOM a středníkem pro Excel). Filtry nemění celkové počty ani export a zůstávají zachované při automatické aktualizaci.

Na stránce žáků jsou dvě rozbalovací minihry: postřeh s lokálním rekordem a pexeso se šesti dvojicemi. Hry neodesílají výsledky na server, neovlivňují docházku a fungují i bez připojení k databázi.
