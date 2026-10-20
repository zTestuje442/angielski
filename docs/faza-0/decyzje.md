# Faza 0 — decyzje (2026-10-19)

Plansza: `plansza.html`, zrzuty: `zrzuty/`.

1. Punkt na ścieżce = `Topic`. Brak osobnego poziomu „podtematów” w `curriculum.json`.
2. Writing zaczyna się od A2: w dziale Writing przycisk A1 jest wyłączony z opisem „od A2”.
3. Wynik zestawu (próg 80%) liczony z pierwszej próby. Zadania powtórzone na końcu zestawu nie podnoszą wyniku.
4. Priorytet szerokości: 1080 px (i 1440 px). Telefon nie jest używany; 360 px zostaje tylko jako minimum „nie psuje się”, bez dopieszczania. Zrzuty do weryfikacji wyglądu: 1080 i 1440 px, jasny i ciemny.
5. Metafora: znaki szlaków PTTK (biały–kolor–biały z obrysem) w kolorach poziomów A1 zielony, A2 żółty, B1 niebieski, B2 czerwony, C1 czarny. „Dziś” = drogowskaz z czasem.

## Faza 1

6. Reading: na każdym poziomie 3 tematy-typy tekstu, w każdym 3 zestawy; zestaw = jeden tekst z pytaniami (9 tekstów na poziom).
7. Wyjaśnienia tematów (`explanation`) powstają w fazie 4 razem z ćwiczeniami; do tego czasu puste, walidator liczy je jako brak treści, nie błąd.
8. `curriculum.json` to płaska tablica `Topic[]`; hierarchia dział → poziom → temat wynika z pól `section`, `level`, `order`. Id: `<poziom>-<slug>`, poza gramatyką z przedrostkiem działu (`vocab-`, `sent-`, `reading-`, `writing-`), zestawy `<topicId>-1…3`.

## Faza 2

9. Formaty treści (pilnuje `validate-content`): id zadania = `<setId>-NN`; match: `answer` = pary `"lewa|prawa"`; error: `answer` = `[błędne słowo z prompt, poprawka]`; transform: `prompt` = polecenie + `\n` + zdanie.
10. `check.ts` rozwija tylko jednoznaczne skróty (n't, 'm, 're, 've, 'll, can't/cannot). 's i 'd są dwuznaczne, więc pełne formy idą do `accept`. Końcowa kropka, `?` i `!` są ignorowane.
11. transform i translate mają wspólny komponent `FreeText` (różnią się tylko poleceniem).
12. Linki „Dodatkowo” na ścieżce pojawią się w fazie 5, razem z `external-links.json`.
13. Każdy temat na ścieżce da się rozwinąć i ćwiczyć, nie tylko „dziś”. Naraz otwarty jest jeden panel (po uwagach do A2); po wejściu na ścieżkę jest to panel „dziś”, a kliknięcie drogowskazu otwiera go ponownie.

## Faza 3

14. Merge powtórek i poziomów na znacznikach czasu: powtórka ma `added` i `done`, wygrywa późniejsze zdarzenie, więc zrobiona powtórka nie wraca z drugiego komputera. Poziom w dziale: wygrywa później wybrany.
15. Synchronizacja przez zwykły `fetch` do `/rest/v1/rpc/get_progress` i `save_progress`, bez `supabase-js`. Kod idzie w treści POST, nigdy w URL-u.
16. Kiedy: przy starcie, 1,5 s po zmianie postępu, po powrocie do karty i po wpisaniu kodu. Wynik z serwera jest łączony z bieżącym stanem, więc zmiany zrobione w trakcie nie giną.
17. Testy e2e mają własny serwer (port 5174) z udawanym Supabase `https://sync.test`, żeby nigdy nie dotykać prawdziwej bazy.

## Faza 4

18. Reading: plik `data/readings/<poziom>/<setId>.json` = jeden tekst (`title`, `text`) + 8–12 pytań. Długość tekstu: A1 ~100 słów → C1 ~600, ±40%. Tekst wyświetla się obok pytań, także w powtórkach.
19. Prawda/fałsz/brak informacji to `choice` z opcjami `True`, `False`, `Not given` w stałej kolejności.
20. Skróty 's i 'd wpisane przez użytkownika są rozwijane do obu pełnych form i porównywane z treścią. Treść podaje pełne formy („He has lived”); „He is lived” nie przechodzi.
21. Walidator pilnuje dodatkowo: dokładnie jednej luki w cloze, kafelków bez zbędnych na A1–A2 i 1–2 zbędnych od B1, różnych elementów po obu stronach match oraz niepowtarzających się opcji w choice.

22. Ekran zadania (uwagi po A1): dolny pasek akcji, w którym informacja zwrotna jest po lewej, a „Sprawdź”/„Dalej” w prawym dolnym rogu. Bieżące zadanie w pasku postępu to wyższa kreska w ramce, licznik pokazuje „Pytanie n z N”.

23. Writing: zadanie otwarte w `data/writing/<poziom>/<topicId>.json` (`task`, `words` [min, max], `model`, `checklist`). Nie liczy się do zaliczenia tematu. Szkic tekstu zapisuje się tylko lokalnie. „Sprawdź z Claude” kopiuje gotowe polecenie (PL) z tekstem i listą kontrolną, a tekst wzorcowy jest ukryty, dopóki użytkownik go nie odsłoni.
24. Ćwiczenia kontrolowane Writing korzystają z istniejących typów zadań; porządkowanie wiadomości to kafelki z całymi zdaniami.

## Faza 5

25. `collect-links.ts` pobiera tylko strony spisów treści (PEG: grammar-explanations; British Council: listy lekcji gramatyki, słownictwa, Reading, Writing i 7 działów Grammar reference; ang.pl: spis treści gramatyki i słownictwa) i bierze z nich tytuł i URL. Przestrzega robots.txt (Disallow, Crawl-delay: ang.pl 60 s) i przedstawia się własnym User-Agentem.
26. Przypisanie linków do tematów jest ręczne, w `scripts/links/rules.json` (temat → lista URL-i). Skrypt zgłasza linki bez tematu, reguły, których adresu nie ma już w spisach, i tematy bez linków w `docs/faza-5/niedopasowane.md`. Jeden URL trafia najwyżej do jednego tematu.
27. Tytuły z drzewiastego spisu ang.pl dostają nazwę rodzica („Present Perfect: for i since”), bo same podstrony nazywają się „zastosowanie” czy „pytania i przeczenia”.
28. Checkbox „zrobione” przy linku zapisuje się w postępie (`links`: URL → `{ done, at }`) i synchronizuje; w merge wygrywa późniejsze kliknięcie, przy remisie „zrobione”. Linki nie wpływają na zaliczenie tematu.

Dodatkowo z weryfikacji: Barlow Condensed i Atkinson Hyperlegible Next mają pełne polskie znaki, ale nie mają glifu ✓, więc znaczniki są ikonami SVG. Fonty w aplikacji zapisane w projekcie (@fontsource).
