"""
Database Utility Module for Learn Platform Integration
Provides connection pooling and helper functions for MySQL and PostgreSQL
"""

import aiomysql
import asyncpg
from typing import Optional, Dict, Any, List
import logging
import os
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class MySQLConnection:
    """MySQL connection manager for Learn Platform database"""
    
    def __init__(self):
        self.pool: Optional[aiomysql.Pool] = None
        self.host = os.getenv('MYSQL_HOST', 'mysql')
        self.user = os.getenv('MYSQL_USER', 'root')
        self.password = os.getenv('MYSQL_PASSWORD', 'example')
        self.db = os.getenv('MYSQL_DB', 'elearning')
        self.port = int(os.getenv('MYSQL_PORT', 3306))
    
    async def connect(self):
        """Initialize MySQL connection pool"""
        try:
            self.pool = await aiomysql.create_pool(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                db=self.db,
                charset='utf8mb4',
                autocommit=False,
                minsize=5,
                maxsize=20
            )
            logger.info(f"MySQL pool created: {self.host}:{self.port}/{self.db}")
        except Exception as e:
            logger.error(f"Failed to create MySQL pool: {e}")
            raise
    
    async def close(self):
        """Close MySQL connection pool"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("MySQL pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Get connection from pool"""
        async with self.pool.acquire() as conn:
            yield conn
    
    async def execute(self, query: str, params: tuple = None) -> int:
        """Execute INSERT/UPDATE/DELETE query"""
        async with self.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(query, params or ())
                await conn.commit()
                return cursor.rowcount
    
    async def fetch_one(self, query: str, params: tuple = None) -> Optional[Dict]:
        """Fetch single row"""
        async with self.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(query, params or ())
                return await cursor.fetchone()
    
    async def fetch_all(self, query: str, params: tuple = None) -> List[Dict]:
        """Fetch all rows"""
        async with self.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(query, params or ())
                return await cursor.fetchall()
    
    async def fetch_paginated(self, query: str, params: tuple = None, 
                             limit: int = 100, offset: int = 0) -> List[Dict]:
        """Fetch paginated results"""
        paginated_query = f"{query} LIMIT %s OFFSET %s"
        paginated_params = (params or ()) + (limit, offset)
        return await self.fetch_all(paginated_query, paginated_params)


class PostgreSQLConnection:
    """PostgreSQL connection manager for Agent analytics data"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.dsn = os.getenv(
            'POSTGRES_URL', 
            'postgresql://learnuser:learnpass@postgres:5432/learndb'
        )
    
    async def connect(self):
        """Initialize PostgreSQL connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.dsn,
                min_size=5,
                max_size=20
            )
            logger.info(f"PostgreSQL pool created")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL pool: {e}")
            raise
    
    async def close(self):
        """Close PostgreSQL connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Get connection from pool"""
        async with self.pool.acquire() as conn:
            yield conn
    
    async def execute(self, query: str, *params) -> str:
        """Execute INSERT/UPDATE/DELETE query"""
        async with self.acquire() as conn:
            return await conn.execute(query, *params)
    
    async def fetch_one(self, query: str, *params) -> Optional[Dict]:
        """Fetch single row"""
        async with self.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, *params) -> List[Dict]:
        """Fetch all rows"""
        async with self.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]


class DatabaseSync:
    """Sync data between MySQL (Learn) and PostgreSQL (Agents)"""
    
    def __init__(self, mysql_conn: MySQLConnection, postgres_conn: PostgreSQLConnection):
        self.mysql = mysql_conn
        self.postgres = postgres_conn
    
    async def sync_users(self):
        """Sync user data from MySQL to PostgreSQL"""
        users = await self.mysql.fetch_all("""
            SELECT id, name, email, role, created_at, updated_at
            FROM users
            WHERE updated_at > NOW() - INTERVAL 1 HOUR
        """)
        
        for user in users:
            await self.postgres.execute("""
                INSERT INTO users (id, name, email, role, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    updated_at = EXCLUDED.updated_at
            """, user['id'], user['name'], user['email'], 
                user['role'], user['created_at'], user['updated_at'])
        
        logger.info(f"Synced {len(users)} users to PostgreSQL")
    
    async def sync_courses(self):
        """Sync course data from MySQL to PostgreSQL"""
        courses = await self.mysql.fetch_all("""
            SELECT id, title_en, title_vi, instructor_id, category_id,
                   price, level, language, rating, total_students,
                   is_published, created_at, updated_at
            FROM courses
            WHERE updated_at > NOW() - INTERVAL 1 HOUR
        """)
        
        for course in courses:
            await self.postgres.execute("""
                INSERT INTO courses (
                    id, title_en, title_vi, instructor_id, category_id,
                    price, level, language, rating, total_students,
                    is_published, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    title_en = EXCLUDED.title_en,
                    title_vi = EXCLUDED.title_vi,
                    rating = EXCLUDED.rating,
                    total_students = EXCLUDED.total_students,
                    is_published = EXCLUDED.is_published,
                    updated_at = EXCLUDED.updated_at
            """, course['id'], course['title_en'], course['title_vi'],
                course['instructor_id'], course['category_id'], course['price'],
                course['level'], course['language'], course['rating'],
                course['total_students'], course['is_published'],
                course['created_at'], course['updated_at'])
        
        logger.info(f"Synced {len(courses)} courses to PostgreSQL")
    
    async def sync_enrollments(self):
        """Sync enrollment data from MySQL to PostgreSQL"""
        enrollments = await self.mysql.fetch_all("""
            SELECT id, user_id, course_id, progress, completed,
                   enrolled_at, completed_at
            FROM enrollments
            WHERE enrolled_at > NOW() - INTERVAL 1 HOUR
               OR completed_at > NOW() - INTERVAL 1 HOUR
        """)
        
        for enrollment in enrollments:
            await self.postgres.execute("""
                INSERT INTO enrollments (
                    id, user_id, course_id, progress, completed,
                    enrolled_at, completed_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    progress = EXCLUDED.progress,
                    completed = EXCLUDED.completed,
                    completed_at = EXCLUDED.completed_at
            """, enrollment['id'], enrollment['user_id'], enrollment['course_id'],
                float(enrollment['progress']), enrollment['completed'],
                enrollment['enrolled_at'], enrollment['completed_at'])
        
        logger.info(f"Synced {len(enrollments)} enrollments to PostgreSQL")
    
    async def sync_all(self):
        """Run full sync of all data"""
        logger.info("Starting full database sync...")
        await self.sync_users()
        await self.sync_courses()
        await self.sync_enrollments()
        logger.info("Database sync completed")


# Global instances
mysql_conn = MySQLConnection()
postgres_conn = PostgreSQLConnection()
db_sync = DatabaseSync(mysql_conn, postgres_conn)


async def init_databases():
    """Initialize both database connections"""
    await mysql_conn.connect()
    await postgres_conn.connect()
    logger.info("All database connections initialized")


async def close_databases():
    """Close all database connections"""
    await mysql_conn.close()
    await postgres_conn.close()
    logger.info("All database connections closed")
