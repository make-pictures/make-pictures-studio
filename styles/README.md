# Custom Styles (`styles/*.style.json`)

Pliki `*.style.json` w tym katalogu definiują wielokrotnego użytku kierunki plastyczne (**Art Direction**) dla Twoich filmów — paletę kolorów, parę fontów Google Fonts (`latin-ext`), fakturę tła, geometrię kart, profil sprężyn oraz domyślny nastrój audio.

- Podgląd na żywo w **60 FPS**: uruchom `npx remotion studio` i wybierz kompozycję **StyleLab**.
- Tworzenie nowego stylu z CLI: `npx make-pictures style new moj-styl --from=editorial-press`
- Użycie stylu w nowym filmie: `npx make-pictures new moj-film --kit=editorial-collage --style=moj-styl`
