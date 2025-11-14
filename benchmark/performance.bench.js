/**
 * Performance benchmark for SQLBuilder optimizations
 * Run with: node benchmark/performance.bench.js
 */

import SQLBuilder from "../src/index.js";

/**
 * Benchmark a function and return execution time
 * @param {string} name - Benchmark name
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations
 */
function benchmark(name, fn, iterations = 10000) {
	// Warmup
	for (let i = 0; i < 100; i++) {
		fn();
	}

	// Measure
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		fn();
	}
	const end = performance.now();
	const duration = end - start;
	const avgTime = duration / iterations;

	console.log(`${name}:`);
	console.log(`  Total: ${duration.toFixed(2)}ms`);
	console.log(`  Average: ${avgTime.toFixed(4)}ms per operation`);
	console.log(`  Throughput: ${(1000 / avgTime).toFixed(0)} ops/sec\n`);

	return duration;
}

console.log("=== SQL Builder Performance Benchmarks ===\n");

// Benchmark 1: Basic SELECT queries
benchmark("Basic SELECT", () => {
	const sql = new SQLBuilder();
	sql.select("*").from("users").where("age", ">", 18).build();
}, 10000);

// Benchmark 2: Complex SELECT with multiple conditions
benchmark("Complex SELECT with WHERE", () => {
	const sql = new SQLBuilder();
	sql.select(["id", "name", "email"])
		.from("users")
		.where("age", ">=", 18)
		.where("status", "active")
		.where("verified", true)
		.orderBy("created_at", "DESC")
		.limit(10)
		.build();
}, 10000);

// Benchmark 3: WHERE IN with many values
benchmark("WHERE IN (10 values)", () => {
	const sql = new SQLBuilder();
	sql.select("*")
		.from("users")
		.whereIn("id", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
		.build();
}, 10000);

// Benchmark 4: WHERE IN with many values
benchmark("WHERE IN (100 values)", () => {
	const sql = new SQLBuilder();
	const values = Array.from({ length: 100 }, (_, i) => i + 1);
	sql.select("*").from("users").whereIn("id", values).build();
}, 10000);

// Benchmark 5: Complex query with JOINs
benchmark("Complex query with JOINs", () => {
	const sql = new SQLBuilder();
	sql.select(["u.id", "u.name", "p.title"])
		.from("users u")
		.leftJoin("posts p", "u.id", "=", "p.user_id")
		.where("u.age", ">=", 18)
		.whereIn("u.status", ["active", "pending"])
		.whereNotNull("u.email")
		.groupBy("u.role")
		.orderBy("u.created_at", "DESC")
		.limit(20)
		.offset(10)
		.build();
}, 10000);

// Benchmark 6: INSERT query
benchmark("INSERT query", () => {
	const sql = new SQLBuilder();
	sql.insert("users", {
		name: "John Doe",
		email: "john@example.com",
		age: 25,
		status: "active",
	}).build();
}, 10000);

// Benchmark 7: UPDATE query
benchmark("UPDATE query", () => {
	const sql = new SQLBuilder();
	sql.update("users", {
		name: "Jane Doe",
		email: "jane@example.com",
	})
		.where("id", 1)
		.build();
}, 10000);

// Benchmark 8: Multiple WHERE conditions
benchmark("10 WHERE conditions", () => {
	const sql = new SQLBuilder();
	let builder = sql.select("*").from("users");
	for (let i = 0; i < 10; i++) {
		builder = builder.where(`field${i}`, "=", i);
	}
	builder.build();
}, 10000);

// Benchmark 9: Identifier validation
benchmark("Identifier validation", () => {
	const sql = new SQLBuilder();
	sql.select(["id", "name", "email", "age", "status"]).from("users").build();
}, 10000);

// Benchmark 10: Query with total count
benchmark("Query with total count", () => {
	const sql = new SQLBuilder();
	sql.select(["id", "name", "email"])
		.from("users")
		.where("status", "active")
		.withTotal()
		.limit(10)
		.offset(20)
		.build();
}, 10000);

console.log("=== Benchmarks Complete ===");
