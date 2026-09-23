-- ZASTOSOWANA 2026-09-23 na projekcie BEAUTY (dhuvykwecsxgchzxufxw).
-- Sprawdzone przed zalozeniem: 0 zduplikowanych par (wniosek_id, nr).
--
-- Jedna lokalizacja o danym numerze w obrebie wniosku. Wymagane przez zapis
-- lokalizacji przez upsert (on conflict wniosek_id, nr), ktory zastapil
-- "skasuj wszystko i wstaw od nowa" - to przy dwoch rownoleglych zapisach
-- (autozapis + przycisk, dwie karty) moglo zostawic zdublowane lokalizacje.
create unique index if not exists mienie_lokalizacje_wniosek_nr_key
  on public.mienie_lokalizacje (wniosek_id, nr);
