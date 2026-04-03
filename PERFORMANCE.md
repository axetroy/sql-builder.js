# Performance Optimizations

This document describes the performance optimizations made to the SQL Builder library.

## Optimizations Implemented

### 1. Cached Regex Patterns (Static class fields)

Regex patterns are compiled once at class load time instead of being recreated on every call.

```javascript
static #IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
static #COUNT_AS_PATTERN = /^COUNT\(\*\)\s+AS\s+(.+)$/i;
```

### 2. Static `#allowedOperators` Set

The operator whitelist was previously created as an instance field, allocating a new `Set` with 13 entries for **every** `new SQLBuilder()` call. Moving it to a static field means it is created only once.

```javascript
static #ALLOWED_OPERATORS = new Set(["=", "!=", "<>", "<", ">", "<=", ">=", "LIKE", "IN", "NOT IN", "IS", "IS NOT", "BETWEEN"]);
```

### 3. Static Cache for Escaped Identifiers

`#escapeIdentifier()` is called for every table name, column, alias, and JOIN target. The same identifier always produces the same escaped result, so results are cached in a static `Map` shared across all instances.

```javascript
static #ESCAPE_CACHE = new Map();
```

On a cache hit `#escapeIdentifier` becomes a single `Map.get` call instead of a regex test plus string split and backtick mapping.

### 4. Fast Path in `#validateIdentifier` Using Escape Cache

`#validateIdentifier` and `#escapeIdentifier` were both called on the same identifier in many places, each running the same regex. When no identifier allowlist is active, a cache hit in `#ESCAPE_CACHE` means the identifier was already validated, so the regex is skipped.

```javascript
if (this.#allowedIdentifiers.size === 0 && SQLBuilder.#ESCAPE_CACHE.has(identifier)) {
    return; // already validated and escaped
}
```

### 5. Static Cache for Placeholder Strings

`#buildPlaceholders(n)` always returns the same string for the same `n`. Results are cached in a static `Map`, turning repeated calls (common in `whereIn` with the same array length) into a single map lookup. The string itself is also built more efficiently:

```javascript
const result = "?, ".repeat(count - 1) + "?";
```

### 6. `#parseTableAndAlias` Without Regex

The original implementation used `split(/\s+/)` to parse `"table alias"`. Replaced with a plain `indexOf(" ")` plus `slice`, which avoids regex execution for every `from()` and `join()` call.

### 7. Avoid Unnecessary Array Copy in `#buildSelect`

The `withTotal` path previously spread the columns array to append one item. It now builds the SELECT clause directly without allocating an intermediate copy.

**Before:**
```javascript
const columns = [...this.#query.columns];
if (this.#query.withTotal) {
    columns.push(`COUNT(*) OVER() AS ${this.#query.withTotal}`);
}
parts.push(`SELECT ${columns.join(", ")}`);
```

**After:**
```javascript
if (this.#query.withTotal) {
    parts.push(`SELECT ${this.#query.columns.join(", ")}, COUNT(*) OVER() AS ${this.#query.withTotal}`);
} else {
    parts.push(`SELECT ${this.#query.columns.join(", ")}`);
}
```

## Performance Results

Benchmarks run with 10,000 iterations each (Node.js v24, M-series hardware).

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Basic SELECT | ~321,000 ops/sec | ~633,000 ops/sec | **+97%** |
| Complex SELECT with WHERE | ~203,000 ops/sec | ~353,000 ops/sec | **+74%** |
| WHERE IN (10 values) | ~453,000 ops/sec | ~883,000 ops/sec | **+95%** |
| WHERE IN (100 values) | ~112,000 ops/sec | ~147,000 ops/sec | **+32%** |
| Complex query with JOINs | ~140,000 ops/sec | ~279,000 ops/sec | **+99%** |
| INSERT query | ~367,000 ops/sec | ~902,000 ops/sec | **+145%** |
| UPDATE query | ~297,000 ops/sec | ~458,000 ops/sec | **+54%** |
| 10 WHERE conditions | ~155,000 ops/sec | ~327,000 ops/sec | **+111%** |
| Identifier validation | ~429,000 ops/sec | ~698,000 ops/sec | **+63%** |
| Query with total count | ~370,000 ops/sec | ~773,000 ops/sec | **+109%** |

## Running Benchmarks

```bash
node benchmark/performance.bench.js
```

## Summary

The optimizations focus on:
1. **Static allocation** – Operator whitelist and regex patterns created once, not per instance
2. **Identifier caching** – Escape and validation results cached in static Maps; hot paths become a single Map lookup
3. **Placeholder caching** – Repeated placeholder strings (e.g. for `whereIn`) computed once and reused
4. **Avoiding intermediate allocations** – No temporary array copy for SELECT columns, no regex for table/alias parsing

These changes maintain 100% backward compatibility while roughly **doubling throughput** across most query patterns.
