try {
  const s = await Deno.readTextFile("/D:/Bots/reflectin/supabase/tests/0002_migration_test.ts");
  console.log("SLASH-DRIVE OK", s.length);
} catch (e) {
  console.log("SLASH-DRIVE ERR", e.message);
}
try {
  const s = await Deno.readTextFile("D:/Bots/reflectin/supabase/migrations/0002_schedule.sql");
  console.log("COLON-DRIVE OK", s.length);
} catch (e) {
  console.log("COLON-DRIVE ERR", e.message);
}