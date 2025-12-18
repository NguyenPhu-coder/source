import pool from "../src/config/db.js";

async function cleanupDatabase() {
  const connection = await pool.getConnection();

  try {
    console.log("🧹 Starting database cleanup...\n");

    // Step 1: Remove help_others badge
    console.log("📝 Step 1: Removing 'Community Helper' badge...");
    await connection.query(
      "DELETE FROM user_badges WHERE badge_id = (SELECT id FROM badges WHERE trigger_type = 'help_others')"
    );
    await connection.query("DELETE FROM badges WHERE trigger_type = 'help_others'");
    console.log("✅ Removed 'Community Helper' badge\n");

    // Step 2: Drop unused tables
    console.log("📝 Step 2: Dropping unused tables...");
    
    await connection.query("DROP TABLE IF EXISTS study_group_members");
    console.log("  ✅ Dropped study_group_members");
    
    await connection.query("DROP TABLE IF EXISTS discussion_comments");
    console.log("  ✅ Dropped discussion_comments");
    
    await connection.query("DROP TABLE IF EXISTS study_groups");
    console.log("  ✅ Dropped study_groups");
    
    await connection.query("DROP TABLE IF EXISTS discussions");
    console.log("  ✅ Dropped discussions");
    
    await connection.query("DROP TABLE IF EXISTS subscriptions");
    console.log("  ✅ Dropped subscriptions");
    
    await connection.query("DROP TABLE IF EXISTS course_analytics");
    console.log("  ✅ Dropped course_analytics\n");

    // Step 3: Show remaining tables
    console.log("📝 Step 3: Remaining tables in database:");
    const [tables] = await connection.query("SHOW TABLES");
    console.table(tables);

    // Step 4: Show remaining badges
    console.log("📝 Step 4: Remaining badges:");
    const [badges] = await connection.query(
      "SELECT id, name_en, trigger_type, trigger_value FROM badges ORDER BY id"
    );
    console.table(badges);

    console.log("\n✅ Database cleanup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

cleanupDatabase();
