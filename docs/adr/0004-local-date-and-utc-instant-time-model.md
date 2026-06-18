# Local date and UTC instant time model

Church Task models church-calendar concepts local-date-first while storing UTC instants for clock comparisons and scheduled jobs. A Cycle is identified by the Church-local Monday `start_date` it represents, while UTC boundary instants may be stored for scheduling and comparisons. Past Cycles keep their date identity if a Church changes time zone later; the current Cycle keeps its existing start boundary but recalculates its end boundary, and future Cycles recalculate from the new Church Time Zone.

Postgres UTC instant columns use `timestamp with time zone` through Drizzle. Zero maps synced date/time values to numeric millisecond timestamps, and app/Zero code treats those values as numbers. Server/Drizzle code uses `Date` values for timestamp columns; Zero mutators and UI code use numeric milliseconds and convert with `new Date(value)` or `date-fns` at formatting/comparison boundaries.

Church-local dates remain strings in `YYYY-MM-DD` form. This applies to domain date identity fields such as Cycle start/end dates, Task due dates, Focus Window dates, Key Date occurrences, and scheduling local dates. Schema fields that pair local dates with UTC instants should make clear which field is the calendar identity and which field is the clock boundary.
