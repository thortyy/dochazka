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

Na stránce žáků je rozbalovací herní sekce: Postřeh, Neon Had, Neon Breaker a 2048. Původní pexeso, piškvorky a počítání byly odstraněny. Hry neodesílají výsledky na server, neovlivňují docházku a fungují i bez připojení k databázi.

## Školní síť a ruční opravy

Omezení školní sítě je ve výchozím stavu vypnuté. Učitel nebo správce v administraci rozbalí **Školní síť**, potvrdí připojení ke škole a klikne na **Povolit tuto síť a zapnout omezení**. Veřejnou adresu určuje Cloudflare (`CF-Connecting-IP`); hodnoty `X-Forwarded-For` se pro povolení nepoužívají. Další školní IP lze přidat stejným způsobem z dané přípojky. IPv6 se porovnává jako konkrétní normalizovaná adresa, nikoli prefix; některé sítě mohou vyžadovat povolení více adres. Mobily sdílející povolenou veřejnou IP mají také přístup.

Omezení platí jen pro `/api/checkin`. Přihlášení a celá administrace včetně ručních oprav jsou dostupné i z domova. Odebrání poslední adresy při zapnutém omezení zablokuje všechny žákovské zápisy; omezení může učitel z administrace kdykoliv vypnout.

Kliknutím na stav žáka v přehledu učitel změní přítomnost i po vypršení limitu zápisu. Změna se zapíše do `attendance_edits` s účtem učitele/správce a časem v UTC. Opravy se vztahují na aktuální hodinu; původní kód a záznamy ostatních žáků zůstanou zachované. Žákovský zápis v otevřeném limitu může znovu označit ručně odebraného žáka jako přítomného.

Seznam je po 10 žácích; lze přepnout na celou třídu. Hledání, filtry, počty a export pracují s celou třídou, nejen s právě zobrazenou stránkou.

## Nová herní sekce

Herní nabídka ani jednotlivé hry se při běžném načtení docházky nestahují. Otevření sekce načte hosta `games.js` a společný styl; další moduly a styly se stahují až při výběru hry. Hry během přepínání zachovávají stav. Akční hry se při odchodu ze záložky, zavření sekce nebo opuštění herní plochy pozastaví. Pokračování je vždy vědomé. Jen Breaker při skutečné hře používá requestAnimationFrame; při pauze je zastavený.

- Postřeh zachovává původní reakční pravidla i klíč rekordu, nově ukazuje poslední pokusy a jejich průměr.
- Neon Had: klávesnice a dotykový D-pad, růst a postupné zrychlování.
- Neon Breaker: tři životy a tři kola, klávesnice, myš nebo dotyk.
- 2048: šipky, tlačítka nebo swipe, vrácení posledního tahu.

Rekordy se ukládají pouze v daném prohlížeči, žádné herní výsledky se neodesílají na server. Všechny hry podporují světlé i tmavé prostředí. Před výměnou her byla uložená větev `backup/pred-novymi-hrami-2026-11-09`.

Čisté testy her bez externích závislostí: `node --test tests/tiles.test.mjs tests/snake.test.mjs tests/breaker.test.mjs`.
