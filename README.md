# Fitness – persönlicher Trainingsplaner

Installierbare Web-App (PWA) ohne Build-Schritt und ohne Abhängigkeiten.

- **Übungen:** über 120 Übungen in Brust, Rücken, Schultern, Arme, Beine, Bauch & Core, Cardio; eigene Übungen anlegen
- **Plan:** pro Kalenderwoche jedem Tag Übungen mit Sätzen × Ziel zuordnen, Vorwoche übernehmen
- **Training:** Gewicht/Wdh. (bzw. Zeit, Minuten/km) pro Satz eintragen, Werte vom letzten Mal als Vorschlag, Pausentimer, Bewertung & Notiz
- **Fortschritt:** Trainings pro Woche, Verlauf je Übung (geschätztes 1RM, Bestwerte), Rekorde, Körpergewicht
- **Kalorien:** Tagesbedarf (Mifflin-St Jeor) und geschätzter Verbrauch pro Training

Alle Daten bleiben im Browser des Geräts (`localStorage`). Backup/Import als JSON im Profil.

Lokal starten: `python3 -m http.server 8000` in diesem Ordner, dann http://localhost:8000 öffnen.
