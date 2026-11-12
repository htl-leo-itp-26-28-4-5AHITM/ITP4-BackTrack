# Datenbank (Supabase)

Login, Teams, Kader, Einheiten, Messdaten und Vergleichsanfragen liegen in einer gehosteten
PostgreSQL-Datenbank bei Supabase. Dadurch kann man sich von jedem Gerät aus anmelden.

## Einrichten (einmalig)

1. Auf https://supabase.com ein Projekt anlegen (Region z. B. Frankfurt).
2. **Authentication → Sign In / Providers → Email**: „Confirm email“ ausschalten
   (sonst muss jeder neue Nutzer zuerst einen Link in der Mail anklicken).
3. **SQL Editor → New query**: den Inhalt von [`schema.sql`](schema.sql) einfügen und **Run** drücken.
   Das Skript darf man nach Änderungen erneut ausführen.
4. **Project Settings → API**: Project URL und `anon` key kopieren.
5. In `web/` die Datei `.env.example` nach `.env.local` kopieren und die beiden Werte eintragen.
   `.env.local` wird nicht committet.
6. `cd web && npm install && npm run dev`

Den `service_role` key und das Datenbank-Passwort nie in die Webseite oder ins Repo schreiben.

## Wer sieht was

Die Regeln stehen als Row Level Security in `schema.sql`, gelten also auch, wenn jemand die
Webseite umgeht und die Datenbank direkt abfragt.

| Tabelle            | Inhalt                                    | Lesen                                                     | Ändern                         |
| ------------------ | ----------------------------------------- | --------------------------------------------------------- | ------------------------------ |
| `profiles`         | Name, Rollen (Trainer/Spieler)            | nur das eigene Profil                                     | nur das eigene                 |
| `teams`            | Teams                                     | Trainer des Teams, Spieler im Kader                       | Trainer                        |
| `members`          | Kader (Name, Nummer, Position, E-Mail)    | Trainer, alle Spieler des Teams                           | Trainer                        |
| `einheiten`        | Trainings und Spiele                      | Trainer, alle Spieler des Teams                           | Trainer                        |
| `tracks`           | GPS- und Pulsdaten pro Spieler und Einheit | Trainer, der Spieler selbst, Spieler mit angenommenem Vergleich | Trainer                  |
| `compare_requests` | Vergleichsanfragen                        | Absender und Empfänger                                    | senden: Absender, annehmen/ablehnen: Empfänger, löschen: beide |
| `tracking_templates` | Vorlagen: Platz-Eckpunkte, Strafräume, Spieldaten | Ersteller, Trainer und Spieler der zugewiesenen Teams | Ersteller                 |
| `template_teams`   | Zuweisung Vorlage → Team                  | Trainer und Spieler des Teams                             | Ersteller der Vorlage, nur an eigene Teams |
| `spiele`           | angelegte Spiele (aus Vorlage), Messdaten hängen als Einheit dran | Ersteller, Trainer des Teams, Spieler bei Team-Spielen | Ersteller          |

Spieler dürfen zusätzlich zu einem Spiel ihres Teams die Einheit anlegen und ihre **eigenen** Tracks
hochladen (nur einfügen, nicht ändern oder löschen).

Ein Spieler wird über die E-Mail im Kader mit seinem Konto verknüpft. Ein Konto kann Trainer
und Spieler zugleich sein (Trainer, der selbst mitspielt).
