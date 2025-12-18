import pool from "../src/config/db.js";

async function cleanLessons() {
  try {
    console.log("🧹 Cleaning lessons...");

    const [result] = await pool.query(`
      UPDATE lessons 
      SET document_url = NULL 
      WHERE id IN (272, 273) AND lesson_type = 'text'
    `);

    console.log(`✅ Cleared document_url for ${result.affectedRows} lessons`);

    const [lessons] = await pool.query(`
      SELECT id, title_vi, lesson_type, document_url, LENGTH(content_text) as len
      FROM lessons 
      WHERE id IN (272, 273)
    `);

    console.table(lessons);
    console.log("✅ Done! Refresh your browser.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

cleanLessons();
