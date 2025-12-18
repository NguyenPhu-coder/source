import pool from "../src/config/db.js";

async function fixImages() {
  try {
    console.log("🖼️  Fixing images to use local files...\n");

    // Step 1: Update course thumbnails - set to use local placeholder
    console.log("📝 Step 1: Updating course thumbnails...");
    const [updateCourses] = await pool.query(`
      UPDATE courses 
      SET thumbnail = '/images/placeholder-course.svg'
      WHERE thumbnail LIKE 'http%' OR thumbnail LIKE 'data:image%'
    `);
    console.log(`✅ Updated ${updateCourses.affectedRows} course thumbnails\n`);

    // Step 2: Update user avatars - set to use local placeholder
    console.log("📝 Step 2: Updating user avatars...");
    const [updateUsers] = await pool.query(`
      UPDATE users 
      SET avatar = '/images/placeholder-avatar.svg'
      WHERE avatar LIKE 'http%' OR avatar LIKE 'data:image%' OR avatar IS NULL
    `);
    console.log(`✅ Updated ${updateUsers.affectedRows} user avatars\n`);

    // Step 3: Update blog thumbnails
    console.log("📝 Step 3: Updating blog thumbnails...");
    const [updateBlogs] = await pool.query(`
      UPDATE blogs 
      SET thumbnail = '/images/placeholder-course.svg'
      WHERE thumbnail LIKE 'http%' OR thumbnail LIKE 'data:image%' OR thumbnail IS NULL
    `);
    console.log(`✅ Updated ${updateBlogs.affectedRows} blog thumbnails\n`);

    // Step 4: Show sample results
    console.log("📝 Step 4: Sample courses after update:");
    const [courses] = await pool.query(`
      SELECT id, SUBSTRING(title_vi, 1, 30) as title, thumbnail 
      FROM courses 
      LIMIT 5
    `);
    console.table(courses);

    console.log("📝 Sample users after update:");
    const [users] = await pool.query(`
      SELECT id, name, email, avatar 
      FROM users 
      LIMIT 5
    `);
    console.table(users);

    console.log("\n✅ Image fix completed successfully!");
    console.log("📌 All images now use local placeholder files:");
    console.log("   - Courses: /images/placeholder-course.svg");
    console.log("   - Avatars: /images/placeholder-avatar.svg\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing images:", error);
    process.exit(1);
  }
}

fixImages();
