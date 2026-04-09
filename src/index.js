/** @private 缓存的单引号转义正则，避免每次调用时重复创建 */
const SINGLE_QUOTE_RE = /'/g;

/**
 * 格式化 SQL 字符串，将参数安全地替换到 SQL 中（仅用于调试）
 * @param {string} sql - SQL 语句
 * @param {any[]} params - 参数数组
 * @returns {string} 格式化后的 SQL 字符串
 */
function formatSQL(sql, params) {
	if (params.length === 0) return sql;

	const parts = sql.split("?");
	const n = parts.length - 1;
	if (n === 0) return sql;

	let result = parts[0];
	for (let i = 0; i < n; i++) {
		const param = params[i];
		if (param === undefined) {
			result += "?" + parts[i + 1];
		} else if (typeof param === "string") {
			result += "'" + param.replace(SINGLE_QUOTE_RE, "''") + "'" + parts[i + 1];
		} else {
			result += param + parts[i + 1];
		}
	}
	return result;
}

/**
 * SQL 构建结果
 * 包含生成的 SQL 语句和参数，toString() 方法将参数安全地内联到 SQL 中（仅用于调试）
 * @class BuildResult
 * @example
 * const result = sqlBuilder.select('*').from('users').where('age', '>', 18).build();
 * console.log(result.sql);    // SELECT * FROM `users` WHERE `age` > ?
 * console.log(result.params); // [18]
 * console.log(result.toString()); // SELECT * FROM `users` WHERE `age` > 18
 */
class BuildResult {
	/**
	 * @param {string} sql - 生成的 SQL 语句（含占位符 ?）
	 * @param {any[]} params - 查询参数数组
	 */
	constructor(sql, params) {
		/** 生成的 SQL 语句 */
		this.sql = sql;
		/** 查询参数数组 */
		this.params = params;
	}

	/**
	 * 返回将参数安全地内联后的完整 SQL 字符串（仅用于调试，不应用于实际查询）
	 * 字符串参数会被单引号包裹，并对内部单引号进行转义，防止 SQL 注入
	 * @returns {string} 格式化的 SQL 字符串
	 */
	toString() {
		return formatSQL(this.sql, this.params);
	}
}

/**
 * 原始 SQL 表达式包装器，用于在 UPDATE 语句中嵌入不参数化的表达式
 * @class RawExpression
 * @example
 * // 创建一个原始 SQL 表达式
 * const expr = new RawExpression('age + 1');
 * // 或使用工厂函数
 * const expr = raw('age + 1');
 */
class RawExpression {
	/**
	 * @param {string} expression - 原始 SQL 表达式（不会被参数化，请勿传入用户输入）
	 */
	constructor(expression) {
		if (typeof expression !== "string" || expression.length === 0) {
			throw new Error("Raw expression must be a non-empty string");
		}
		this.expression = expression;
	}
}

/**
 * 创建一个原始 SQL 表达式，用于在 UPDATE 语句中嵌入不参数化的列表达式。
 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入此函数。
 * @param {string} expression - 原始 SQL 表达式
 * @returns {RawExpression}
 * @example
 * sqlBuilder.update('users', { age: raw('age + 1') }).where('id', 1);
 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
 */
function raw(expression) {
	return new RawExpression(expression);
}

/**
 * JOIN ON 条件构建器，用于构建复杂的 ON 条件（多个 AND/OR 子条件）
 * @class JoinClause
 * @example
 * sql.join('posts', (on) => {
 *   on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status');
 * });
 */
class JoinClause {
	/**
	 * @private
	 * @type {Array<{first: string, operator: string, second: string, connector: string}>}
	 */
	#conditions = [];

	/**
	 * @private
	 */
	#validateIdentifier;

	/**
	 * @private
	 */
	#validateOperator;

	/**
	 * @private
	 */
	#escapeIdentifier;

	/**
	 * @param {Function} validateIdentifier
	 * @param {Function} validateOperator
	 * @param {Function} escapeIdentifier
	 */
	constructor(validateIdentifier, validateOperator, escapeIdentifier) {
		this.#validateIdentifier = validateIdentifier;
		this.#validateOperator = validateOperator;
		this.#escapeIdentifier = escapeIdentifier;
	}

	/**
	 * 添加一个 AND ON 条件
	 * @param {string} first - 第一个连接条件列
	 * @param {string} operator - 操作符
	 * @param {string} second - 第二个连接条件列
	 * @returns {JoinClause}
	 * @example
	 * on.on('users.id', '=', 'posts.user_id')
	 */
	on(first, operator, second) {
		this.#validateIdentifier(first);
		this.#validateIdentifier(second);
		this.#validateOperator(operator);
		this.#conditions.push({
			first: this.#escapeIdentifier(first),
			operator,
			second: this.#escapeIdentifier(second),
			connector: "AND",
		});
		return this;
	}

	/**
	 * 添加一个 OR ON 条件
	 * @param {string} first - 第一个连接条件列
	 * @param {string} operator - 操作符
	 * @param {string} second - 第二个连接条件列
	 * @returns {JoinClause}
	 * @example
	 * on.on('users.id', '=', 'posts.user_id').orOn('users.uuid', '=', 'posts.user_uuid')
	 */
	orOn(first, operator, second) {
		this.#validateIdentifier(first);
		this.#validateIdentifier(second);
		this.#validateOperator(operator);
		this.#conditions.push({
			first: this.#escapeIdentifier(first),
			operator,
			second: this.#escapeIdentifier(second),
			connector: "OR",
		});
		return this;
	}

	/**
	 * 返回已收集的条件数组
	 * @returns {Array<{first: string, operator: string, second: string, connector: string}>}
	 */
	getConditions() {
		return this.#conditions;
	}
}

/**
 * 安全的 SQL 查询构建器
 * 提供全面的 SQL 注入防护，使用参数化查询和标识符验证
 * @class SQLBuilder
 * @example
 * const sql = new SQLBuilder();
 * const query = sql.select('*').from('users').where('age', '>', 18).build();
 * console.log(query.sql); // SELECT * FROM `users` WHERE `age` > ?
 * console.log(query.params); // [18]
 */
class SQLBuilder {
	/**
	 * Cached regex patterns for better performance
	 * @private
	 * @static
	 */
	static #IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
	static #COUNT_AS_PATTERN = /^COUNT\(\*\)\s+AS\s+(.+)$/i;

	/**
	 * Static cache for escaped identifier results (shared across all instances)
	 * @private
	 * @static
	 */
	static #ESCAPE_CACHE = new Map();

	/**
	 * Static cache for placeholder strings (shared across all instances)
	 * @private
	 * @static
	 */
	static #PLACEHOLDER_CACHE = new Map();

	/**
	 * 允许的 SQL 操作符白名单（静态，所有实例共享）
	 * Allowed SQL operators whitelist (static, shared across all instances)
	 * @private
	 * @static
	 * @type {Set<string>}
	 */
	static #ALLOWED_OPERATORS = new Set(["=", "!=", "<>", "<", ">", "<=", ">=", "LIKE", "IN", "NOT IN", "IS", "IS NOT", "BETWEEN"]);

	/**
	 * @private
	 */
	#query = {
		type: "SELECT",
		table: null,
		tableAlias: null,
		columns: ["*"],
		distinct: false,
		where: [],
		joins: [],
		orderBy: [],
		groupBy: [],
		having: [],
		limit: null,
		offset: null,
		values: {},
		set: {},
		upsertUpdate: null,
		withTotal: undefined,
		lock: null,
		returning: null,
		insertRows: null,
		unions: [],
	};

	/**
	 * @private
	 * @type {Array<any>}
	 */
	#params = [];

	/**
	 * @private
	 * @type {Array<any>}
	 */
	#setParams = [];

	/**
	 * @private
	 * @type {Set<string>}
	 */
	#allowedIdentifiers = new Set();

	/**
	 * 创建 SQLBuilder 实例
	 * @constructor
	 * @example
	 * const sql = new SQLBuilder();
	 */
	constructor() {
		// No need to reinitialize - already initialized above
	}

	/**
	 * 转义 SQL 标识符（表名、列名）
	 * @private
	 * @param {string} identifier - 要转义的标识符
	 * @returns {string} 转义后的标识符
	 * @throws {Error} 当标识符包含非法字符时抛出错误
	 */
	#escapeIdentifier(identifier) {
		if (typeof identifier !== "string") {
			throw new Error("Identifier must be a string");
		}

		const cached = SQLBuilder.#ESCAPE_CACHE.get(identifier);
		if (cached !== undefined) return cached;

		let result;
		// 允许字母、数字、下划线、点号（用于 table.column）
		if (!SQLBuilder.#IDENTIFIER_PATTERN.test(identifier)) {
			// 兼容 COUNT(*) AS total 等函数调用的情况
			const match = SQLBuilder.#COUNT_AS_PATTERN.exec(identifier);

			if (match) {
				const alias = match[1];
				result = `COUNT(*) AS ${this.#escapeIdentifier(alias)}`;
			} else {
				throw new Error(`Invalid identifier format: ${identifier}`);
			}
		} else {
			// 分割可能有的表别名 (table.column)
			const parts = identifier.split(".");
			result = parts.map((part) => `\`${part}\``).join(".");
		}

		SQLBuilder.#ESCAPE_CACHE.set(identifier, result);
		return result;
	}

	/**
	 * 解析表名和别名
	 * @private
	 * @param {string} table - 表名，可以包含别名（如 "users u"）
	 * @returns {{table: string, alias: string|null}} 解析后的表名和别名
	 */
	#parseTableAndAlias(table) {
		const trimmed = table.trim();
		const spaceIdx = trimmed.indexOf(" ");
		if (spaceIdx === -1) {
			return { table: trimmed, alias: null };
		}
		const alias = trimmed.slice(spaceIdx + 1).trimStart();
		return { table: trimmed.slice(0, spaceIdx), alias: alias || null };
	}

	/**
	 * 验证标识符是否安全
	 * @private
	 * @param {string} identifier - 要验证的标识符
	 * @throws {Error} 当标识符不安全时抛出错误
	 */
	#validateIdentifier(identifier) {
		if (typeof identifier !== "string") {
			throw new Error("Identifier must be a string");
		}

		// Fast path: already escaped (and thus validated) with no allowlist restriction
		if (this.#allowedIdentifiers.size === 0 && SQLBuilder.#ESCAPE_CACHE.has(identifier)) {
			return;
		}

		// 基本格式验证
		if (!SQLBuilder.#IDENTIFIER_PATTERN.test(identifier)) {
			// 兼容 COUNT(*) AS total 等函数调用的情况
			const match = SQLBuilder.#COUNT_AS_PATTERN.exec(identifier);

			if (match) {
				const alias = match[1];
				return this.#validateIdentifier(alias);
			}

			throw new Error(`Potential SQL injection detected in identifier: ${identifier}`);
		}

		// 白名单验证（如果设置了白名单）
		if (this.#allowedIdentifiers.size > 0 && !this.#allowedIdentifiers.has(identifier)) {
			throw new Error(`Identifier not in whitelist: ${identifier}`);
		}
	}

	/**
	 * 验证操作符是否安全
	 * @private
	 * @param {string} operator - 要验证的操作符
	 * @throws {Error} 当操作符不在白名单时抛出错误
	 */
	#validateOperator(operator) {
		if (!SQLBuilder.#ALLOWED_OPERATORS.has(operator.toUpperCase())) {
			throw new Error(`Unsupported or dangerous operator: ${operator}`);
		}
	}

	/**
	 * 构建占位符字符串
	 * @private
	 * @param {number} count - 占位符数量
	 * @returns {string} 占位符字符串，例如 "?, ?, ?"
	 */
	#buildPlaceholders(count) {
		if (count <= 0) return "";
		if (count === 1) return "?";

		const cached = SQLBuilder.#PLACEHOLDER_CACHE.get(count);
		if (cached !== undefined) return cached;

		const result = "?, ".repeat(count - 1) + "?";
		SQLBuilder.#PLACEHOLDER_CACHE.set(count, result);
		return result;
	}

	/**
	 * 设置标识符白名单
	 * @param {string[]} identifiers - 允许的标识符列表
	 * @returns {SQLBuilder}
	 * @example
	 * sql.setAllowedIdentifiers(['users', 'id', 'name', 'email']);
	 */
	setAllowedIdentifiers(identifiers) {
		if (!Array.isArray(identifiers)) {
			throw new Error("Identifiers must be an array");
		}

		this.#allowedIdentifiers = new Set(identifiers);
		return this;
	}

	/**
	 * 重置构建器状态
	 * @returns {SQLBuilder}
	 * @example
	 * sql.reset().select('*').from('users');
	 */
	reset() {
		this.#query = {
			type: "SELECT",
			table: null,
			tableAlias: null,
			columns: ["*"],
			distinct: false,
			where: [],
			joins: [],
			orderBy: [],
			groupBy: [],
			having: [],
			limit: null,
			offset: null,
			values: {},
			set: {},
			upsertUpdate: null,
			withTotal: undefined,
			lock: null,
			returning: null,
			insertRows: null,
			unions: [],
		};
		this.#params = [];
		this.#setParams = [];
		return this;
	}

	/**
	 * 设置 SELECT 查询的列
	 * @param {string|string[]|RawExpression|Array<string|RawExpression>} columns - 要查询的列名或原始 SQL 表达式，默认为 ['*']
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select(['id', 'name', 'email']);
	 * sql.select('*'); // 查询所有列
	 * sql.select(['u.id', 'u.name']); // 使用表别名
	 * sql.select(raw('COALESCE(name, email) AS display_name')); // 原始表达式
	 */
	select(columns = ["*"]) {
		this.#query.type = "SELECT";

		const columnArray = Array.isArray(columns) ? columns : [columns];
		this.#query.columns = columnArray.map((col) => {
			if (col instanceof RawExpression) {
				return col.expression;
			}
			if (col !== "*") {
				this.#validateIdentifier(col);
				return this.#escapeIdentifier(col);
			}
			return col;
		});

		return this;
	}

	/**
	 * 启用 SELECT DISTINCT 去重查询
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('name').distinct().from('users');
	 * // SELECT DISTINCT `name` FROM `users`
	 */
	distinct() {
		this.#query.distinct = true;
		return this;
	}

	/**
	 * 设置查询的表名
	 * @param {string} table - 表名，可以包含别名（如 "users u" 或 "users AS u"）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.from('users');
	 * sql.from('users u'); // 使用表别名
	 * sql.from('users AS u'); // 使用 AS 关键字
	 * sql.from('database.users'); // 使用数据库限定表名
	 */
	from(table) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		this.#query.table = this.#escapeIdentifier(tableName);
		this.#query.tableAlias = alias ? this.#escapeIdentifier(alias) : null;

		return this;
	}

	/**
	 * 添加 WHERE 条件（支持分组括号嵌套）
	 * @param {string|Function} columnOrCallback - 列名，或分组回调函数
	 * @param {string} [operator] - 操作符，默认为 '='
	 * @param {any} [value] - 值（当只有两个参数时，第二个参数作为值）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.where('age', '>', 18);
	 * sql.where('name', 'John'); // 默认使用 = 操作符
	 * sql.where('status', 'IS', null);
	 * sql.where('u.id', 1); // 使用表别名
	 * // 分组（括号嵌套）
	 * sql.where('age', '>', 18).where(q => q.where('status', 'active').orWhere('status', 'pending'));
	 * // WHERE `age` > ? AND (`status` = ? OR `status` = ?)
	 */
	where(columnOrCallback, operator, value) {
		if (typeof columnOrCallback === "function") {
			const subBuilder = new SQLBuilder();
			if (this.#allowedIdentifiers.size > 0) {
				subBuilder.#allowedIdentifiers = new Set(this.#allowedIdentifiers);
			}
			columnOrCallback(subBuilder);
			if (subBuilder.#query.where.length > 0) {
				this.#query.where.push({
					type: "group",
					connector: "AND",
					conditions: subBuilder.#query.where,
				});
				this.#params.push(...subBuilder.#params);
			}
			return this;
		}

		const column = columnOrCallback;
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}

		this.#validateIdentifier(column);
		this.#validateOperator(operator);

		const upperOperator = operator.toUpperCase();

		// IS / IS NOT 只能配合 null 使用
		if ((upperOperator === "IS" || upperOperator === "IS NOT") && value !== null) {
			throw new Error(`Operator "${operator}" requires the value to be null`);
		}

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator,
			value,
			connector: "AND",
		});

		// 对于 IS NULL 和 IS NOT NULL，不需要参数
		if (upperOperator !== "IS" && upperOperator !== "IS NOT") {
			this.#params.push(value);
		}

		return this;
	}

	/**
	 * 添加 OR WHERE 条件（支持分组括号嵌套）
	 * @param {string|Function} columnOrCallback - 列名，或分组回调函数
	 * @param {string} [operator] - 操作符，默认为 '='
	 * @param {any} [value] - 值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.where('status', 'active').orWhere('status', 'pending');
	 * sql.orWhere('u.role', 'admin'); // 使用表别名
	 * // 分组（括号嵌套）
	 * sql.where('type', 'vip').orWhere(q => q.where('age', '>', 60).where('member', true));
	 * // WHERE `type` = ? OR (`age` > ? AND `member` = ?)
	 */
	orWhere(columnOrCallback, operator, value) {
		if (typeof columnOrCallback === "function") {
			const subBuilder = new SQLBuilder();
			if (this.#allowedIdentifiers.size > 0) {
				subBuilder.#allowedIdentifiers = new Set(this.#allowedIdentifiers);
			}
			columnOrCallback(subBuilder);
			if (subBuilder.#query.where.length > 0) {
				this.#query.where.push({
					type: "group",
					connector: "OR",
					conditions: subBuilder.#query.where,
				});
				this.#params.push(...subBuilder.#params);
			}
			return this;
		}

		const column = columnOrCallback;
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}

		this.#validateIdentifier(column);
		this.#validateOperator(operator);

		const upperOperator = operator.toUpperCase();

		// IS / IS NOT 只能配合 null 使用
		if ((upperOperator === "IS" || upperOperator === "IS NOT") && value !== null) {
			throw new Error(`Operator "${operator}" requires the value to be null`);
		}

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator,
			value,
			connector: "OR",
		});

		// 对于 IS NULL 和 IS NOT NULL，不需要参数
		if (upperOperator !== "IS" && upperOperator !== "IS NOT") {
			this.#params.push(value);
		}

		return this;
	}

	/**
	 * 添加 WHERE IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 values 不是数组或为空时抛出错误
	 * @example
	 * sql.whereIn('status', ['active', 'pending', 'inactive']);
	 * sql.whereIn('u.role', ['admin', 'user']); // 使用表别名
	 */
	whereIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("whereIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IN",
			value: `(${this.#buildPlaceholders(values.length)})`,
			connector: "AND",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 WHERE NOT IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNotIn('role', ['admin', 'superuser']);
	 * sql.whereNotIn('u.category', [1, 2, 3]); // 使用表别名
	 */
	whereNotIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("whereNotIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "NOT IN",
			value: `(${this.#buildPlaceholders(values.length)})`,
			connector: "AND",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 LIKE 条件，自动在值两侧添加 % 通配符
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereLike('name', 'John'); // 搜索包含 'John' 的名称
	 * sql.whereLike('u.username', 'admin'); // 使用表别名
	 */
	whereLike(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `%${value}%`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "AND",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 LIKE 前缀匹配条件（STARTS WITH）
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereStartsWith('name', 'John'); // 搜索以 'John' 开头的名称
	 * sql.whereStartsWith('u.username', 'admin'); // 使用表别名
	 */
	whereStartsWith(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `${value}%`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "AND",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 LIKE 后缀匹配条件（ENDS WITH）
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereEndsWith('email', '@example.com'); // 搜索以 '@example.com' 结尾的邮箱
	 * sql.whereEndsWith('u.username', 'admin'); // 使用表别名
	 */
	whereEndsWith(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `%${value}`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "AND",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 BETWEEN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any} start - 范围开始值
	 * @param {any} end - 范围结束值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereBetween('age', 18, 65);
	 * sql.whereBetween('created_at', '2023-01-01', '2023-12-31');
	 * sql.whereBetween('u.score', 80, 100); // 使用表别名
	 */
	whereBetween(column, start, end) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "BETWEEN",
			value: `? AND ?`,
			connector: "AND",
		});
		this.#params.push(start, end);

		return this;
	}

	/**
	 * 添加 IS NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNull('deleted_at');
	 * sql.whereNull('u.deleted_at'); // 使用表别名
	 */
	whereNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS",
			value: null,
			connector: "AND",
		});

		return this;
	}

	/**
	 * 添加 IS NOT NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNotNull('email');
	 * sql.whereNotNull('u.email'); // 使用表别名
	 */
	whereNotNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS NOT",
			value: null,
			connector: "AND",
		});

		return this;
	}

	/**
	 * 添加 OR WHERE IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 values 不是数组或为空时抛出错误
	 * @example
	 * sql.where('type', 'vip').orWhereIn('status', ['active', 'pending']);
	 * sql.orWhereIn('u.role', ['admin', 'user']); // 使用表别名
	 */
	orWhereIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("orWhereIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IN",
			value: `(${this.#buildPlaceholders(values.length)})`,
			connector: "OR",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 OR WHERE NOT IN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any[]} values - 值数组
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 values 不是数组或为空时抛出错误
	 * @example
	 * sql.where('type', 'vip').orWhereNotIn('role', ['admin', 'superuser']);
	 * sql.orWhereNotIn('u.category', [1, 2, 3]); // 使用表别名
	 */
	orWhereNotIn(column, values) {
		if (!Array.isArray(values) || values.length === 0) {
			throw new Error("orWhereNotIn requires a non-empty array");
		}

		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "NOT IN",
			value: `(${this.#buildPlaceholders(values.length)})`,
			connector: "OR",
		});
		this.#params.push(...values);

		return this;
	}

	/**
	 * 添加 OR LIKE 条件，自动在值两侧添加 % 通配符
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereLike('name', 'John').orWhereLike('name', 'Jane');
	 * sql.orWhereLike('u.username', 'admin'); // 使用表别名
	 */
	orWhereLike(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `%${value}%`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "OR",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 OR LIKE 前缀匹配条件（OR STARTS WITH）
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereStartsWith('name', 'John').orWhereStartsWith('name', 'Jane');
	 */
	orWhereStartsWith(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `${value}%`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "OR",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 OR LIKE 后缀匹配条件（OR ENDS WITH）
	 * @param {string} column - 列名，可以使用表别名
	 * @param {string} value - 搜索值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereEndsWith('email', '@example.com').orWhereEndsWith('email', '@test.com');
	 */
	orWhereEndsWith(column, value) {
		this.#validateIdentifier(column);

		const searchValue = `%${value}`;

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "LIKE",
			value: searchValue,
			connector: "OR",
		});
		this.#params.push(searchValue);

		return this;
	}

	/**
	 * 添加 OR BETWEEN 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @param {any} start - 范围开始值
	 * @param {any} end - 范围结束值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereBetween('age', 0, 17).orWhereBetween('age', 66, 100);
	 * sql.orWhereBetween('u.score', 80, 100); // 使用表别名
	 */
	orWhereBetween(column, start, end) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "BETWEEN",
			value: `? AND ?`,
			connector: "OR",
		});
		this.#params.push(start, end);

		return this;
	}

	/**
	 * 添加 OR IS NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNull('deleted_at').orWhereNull('archived_at');
	 * sql.orWhereNull('u.deleted_at'); // 使用表别名
	 */
	orWhereNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS",
			value: null,
			connector: "OR",
		});

		return this;
	}

	/**
	 * 添加 OR IS NOT NULL 条件
	 * @param {string} column - 列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereNotNull('email').orWhereNotNull('phone');
	 * sql.orWhereNotNull('u.email'); // 使用表别名
	 */
	orWhereNotNull(column) {
		this.#validateIdentifier(column);

		this.#query.where.push({
			column: this.#escapeIdentifier(column),
			operator: "IS NOT",
			value: null,
			connector: "OR",
		});

		return this;
	}

	/**
	 * 添加原始 WHERE 条件（高级用户逃生通道）
	 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入 expression 参数。
	 * @param {string} expression - 原始 SQL 条件表达式
	 * @param {any[]} [params=[]] - 与表达式中占位符对应的参数数组
	 * @returns {SQLBuilder}
	 * @example
	 * sql.whereRaw('age > 18');
	 * sql.whereRaw('age > ? AND age < ?', [18, 65]);
	 * sql.whereRaw('JSON_CONTAINS(tags, ?)', ['"admin"']);
	 */
	whereRaw(expression, params = []) {
		if (typeof expression !== "string" || expression.length === 0) {
			throw new Error("whereRaw requires a non-empty string expression");
		}

		const placeholderCount = (expression.match(/\?/g) || []).length;
		if (placeholderCount !== params.length) {
			throw new Error(`whereRaw: expression has ${placeholderCount} placeholder(s) but ${params.length} param(s) were provided`);
		}

		this.#query.where.push({
			type: "raw",
			expression,
			connector: "AND",
		});
		this.#params.push(...params);

		return this;
	}

	/**
	 * 添加原始 OR WHERE 条件（高级用户逃生通道）
	 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入 expression 参数。
	 * @param {string} expression - 原始 SQL 条件表达式
	 * @param {any[]} [params=[]] - 与表达式中占位符对应的参数数组
	 * @returns {SQLBuilder}
	 * @example
	 * sql.where('status', 'active').orWhereRaw('age > 60');
	 * sql.orWhereRaw('score BETWEEN ? AND ?', [80, 100]);
	 */
	orWhereRaw(expression, params = []) {
		if (typeof expression !== "string" || expression.length === 0) {
			throw new Error("orWhereRaw requires a non-empty string expression");
		}

		const placeholderCount = (expression.match(/\?/g) || []).length;
		if (placeholderCount !== params.length) {
			throw new Error(`orWhereRaw: expression has ${placeholderCount} placeholder(s) but ${params.length} param(s) were provided`);
		}

		this.#query.where.push({
			type: "raw",
			expression,
			connector: "OR",
		});
		this.#params.push(...params);

		return this;
	}

	/**
	 * 添加 WHERE EXISTS 子查询存在性判断（AND 连接）
	 * @param {SQLBuilder} subquery - 子查询 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('*').from('users')
	 *   .whereExists(new SQLBuilder().select('*').from('orders').whereRaw('orders.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE EXISTS (SELECT * FROM `orders` WHERE orders.user_id = users.id)
	 */
	whereExists(subquery) {
		if (!(subquery instanceof SQLBuilder)) {
			throw new Error("whereExists requires a SQLBuilder instance as subquery");
		}
		this.#query.where.push({
			type: "exists",
			operator: "EXISTS",
			subquery,
			connector: "AND",
		});
		return this;
	}

	/**
	 * 添加 WHERE NOT EXISTS 子查询存在性判断（AND 连接）
	 * @param {SQLBuilder} subquery - 子查询 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('*').from('users')
	 *   .whereNotExists(new SQLBuilder().select('*').from('bans').whereRaw('bans.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE NOT EXISTS (SELECT * FROM `bans` WHERE bans.user_id = users.id)
	 */
	whereNotExists(subquery) {
		if (!(subquery instanceof SQLBuilder)) {
			throw new Error("whereNotExists requires a SQLBuilder instance as subquery");
		}
		this.#query.where.push({
			type: "exists",
			operator: "NOT EXISTS",
			subquery,
			connector: "AND",
		});
		return this;
	}

	/**
	 * 添加 OR WHERE EXISTS 子查询存在性判断（OR 连接）
	 * @param {SQLBuilder} subquery - 子查询 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('*').from('users')
	 *   .where('status', 'vip')
	 *   .orWhereExists(new SQLBuilder().select('*').from('orders').whereRaw('orders.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE `status` = ? OR EXISTS (SELECT * FROM `orders` WHERE orders.user_id = users.id)
	 */
	orWhereExists(subquery) {
		if (!(subquery instanceof SQLBuilder)) {
			throw new Error("orWhereExists requires a SQLBuilder instance as subquery");
		}
		this.#query.where.push({
			type: "exists",
			operator: "EXISTS",
			subquery,
			connector: "OR",
		});
		return this;
	}

	/**
	 * 添加 OR WHERE NOT EXISTS 子查询存在性判断（OR 连接）
	 * @param {SQLBuilder} subquery - 子查询 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @example
	 * sql.select('*').from('users')
	 *   .where('status', 'vip')
	 *   .orWhereNotExists(new SQLBuilder().select('*').from('bans').whereRaw('bans.user_id = users.id'));
	 * // SELECT * FROM `users` WHERE `status` = ? OR NOT EXISTS (SELECT * FROM `bans` WHERE bans.user_id = users.id)
	 */
	orWhereNotExists(subquery) {
		if (!(subquery instanceof SQLBuilder)) {
			throw new Error("orWhereNotExists requires a SQLBuilder instance as subquery");
		}
		this.#query.where.push({
			type: "exists",
			operator: "NOT EXISTS",
			subquery,
			connector: "OR",
		});
		return this;
	}

	/**
	 * 添加 INNER JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @param {string|Function} first - 第一个连接条件列，或接收 JoinClause 的回调函数（用于复杂 ON 条件）
	 * @param {string} [operator] - 操作符（当 first 为字符串时必填）
	 * @param {string} [second] - 第二个连接条件列（当 first 为字符串时必填）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.join('posts', 'users.id', '=', 'posts.user_id');
	 * sql.join('profiles p', 'users.id', '=', 'p.user_id'); // 使用表别名
	 * sql.join('database.posts p', 'u.id', '=', 'p.user_id'); // 使用数据库限定表名和别名
	 * // 复杂 ON 条件（回调形式）
	 * sql.join('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 */
	join(table, first, operator, second) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		if (typeof first === "function") {
			const joinClause = new JoinClause(
				(id) => this.#validateIdentifier(id),
				(op) => this.#validateOperator(op),
				(id) => this.#escapeIdentifier(id),
			);
			first(joinClause);
			this.#query.joins.push({
				type: "INNER",
				table: joinedTable,
				conditions: joinClause.getConditions(),
			});
		} else {
			this.#validateIdentifier(first);
			this.#validateIdentifier(second);
			this.#validateOperator(operator);
			this.#query.joins.push({
				type: "INNER",
				table: joinedTable,
				condition: {
					first: this.#escapeIdentifier(first),
					operator,
					second: this.#escapeIdentifier(second),
				},
			});
		}
		return this;
	}

	/**
	 * 添加 LEFT JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @param {string|Function} first - 第一个连接条件列，或接收 JoinClause 的回调函数（用于复杂 ON 条件）
	 * @param {string} [operator] - 操作符（当 first 为字符串时必填）
	 * @param {string} [second] - 第二个连接条件列（当 first 为字符串时必填）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * sql.leftJoin('profiles p', 'users.id', '=', 'p.user_id'); // 使用表别名
	 * // 复杂 ON 条件（回调形式）
	 * sql.leftJoin('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 */
	leftJoin(table, first, operator, second) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		if (typeof first === "function") {
			const joinClause = new JoinClause(
				(id) => this.#validateIdentifier(id),
				(op) => this.#validateOperator(op),
				(id) => this.#escapeIdentifier(id),
			);
			first(joinClause);
			this.#query.joins.push({
				type: "LEFT",
				table: joinedTable,
				conditions: joinClause.getConditions(),
			});
		} else {
			this.#validateIdentifier(first);
			this.#validateIdentifier(second);
			this.#validateOperator(operator);
			this.#query.joins.push({
				type: "LEFT",
				table: joinedTable,
				condition: {
					first: this.#escapeIdentifier(first),
					operator,
					second: this.#escapeIdentifier(second),
				},
			});
		}
		return this;
	}

	/**
	 * 添加 RIGHT JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @param {string|Function} first - 第一个连接条件列，或接收 JoinClause 的回调函数（用于复杂 ON 条件）
	 * @param {string} [operator] - 操作符（当 first 为字符串时必填）
	 * @param {string} [second] - 第二个连接条件列（当 first 为字符串时必填）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.rightJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * sql.rightJoin('profiles p', 'users.id', '=', 'p.user_id'); // 使用表别名
	 * // 复杂 ON 条件（回调形式）
	 * sql.rightJoin('posts', (on) => on.on('users.id', '=', 'posts.user_id').on('users.status', '=', 'posts.status'));
	 */
	rightJoin(table, first, operator, second) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		if (typeof first === "function") {
			const joinClause = new JoinClause(
				(id) => this.#validateIdentifier(id),
				(op) => this.#validateOperator(op),
				(id) => this.#escapeIdentifier(id),
			);
			first(joinClause);
			this.#query.joins.push({
				type: "RIGHT",
				table: joinedTable,
				conditions: joinClause.getConditions(),
			});
		} else {
			this.#validateIdentifier(first);
			this.#validateIdentifier(second);
			this.#validateOperator(operator);
			this.#query.joins.push({
				type: "RIGHT",
				table: joinedTable,
				condition: {
					first: this.#escapeIdentifier(first),
					operator,
					second: this.#escapeIdentifier(second),
				},
			});
		}
		return this;
	}

	/**
	 * 添加 CROSS JOIN 连接
	 * @param {string} table - 要连接的表名，可以包含别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.crossJoin('products');
	 * sql.crossJoin('products p'); // 使用表别名
	 */
	crossJoin(table) {
		const { table: tableName, alias } = this.#parseTableAndAlias(table.replace(/ AS /i, " "));

		this.#validateIdentifier(tableName);
		if (alias) {
			this.#validateIdentifier(alias);
		}

		const escapedTable = this.#escapeIdentifier(tableName);
		const joinedTable = alias ? `${escapedTable} ${this.#escapeIdentifier(alias)}` : escapedTable;

		this.#query.joins.push({
			type: "CROSS",
			table: joinedTable,
			condition: null,
		});
		return this;
	}

	/**
	 * 添加排序条件
	 * @param {string} column - 排序列名，可以使用表别名
	 * @param {'ASC'|'DESC'} direction - 排序方向
	 * @returns {SQLBuilder}
	 * @example
	 * sql.orderBy('created_at', 'DESC');
	 * sql.orderBy('name', 'ASC');
	 * sql.orderBy('u.created_at', 'DESC'); // 使用表别名
	 */
	orderBy(column, direction = "ASC") {
		this.#validateIdentifier(column);

		const upperDirection = direction.toUpperCase();
		if (!["ASC", "DESC"].includes(upperDirection)) {
			throw new Error("Order direction must be ASC or DESC");
		}

		this.#query.orderBy.push({
			column: this.#escapeIdentifier(column),
			direction: upperDirection,
		});
		return this;
	}

	/**
	 * 添加分组条件
	 * @param {string|string[]} columns - 分组列名，可以使用表别名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.groupBy('category');
	 * sql.groupBy(['category', 'status']);
	 * sql.groupBy(['u.category', 'u.status']); // 使用表别名
	 */
	groupBy(columns) {
		const columnArray = Array.isArray(columns) ? columns : [columns];
		columnArray.forEach((col) => this.#validateIdentifier(col));

		this.#query.groupBy = columnArray.map((col) => this.#escapeIdentifier(col));
		return this;
	}

	/**
	 * 添加 HAVING 条件
	 * @param {string} column - 列名或聚合表达式（例如 'COUNT(*)'）
	 * @param {string} operator - 比较操作符
	 * @param {any} value - 比较值
	 * @returns {SQLBuilder}
	 * @example
	 * sql.groupBy('category').having('COUNT(*)', '>', 5);
	 * sql.groupBy('status').having('SUM(amount)', '>=', 1000);
	 */
	having(column, operator, value) {
		if (typeof column !== "string" || column.length === 0) {
			throw new Error("having requires a non-empty string column");
		}

		this.#validateOperator(operator);

		const upperOperator = operator.toUpperCase();

		// IS / IS NOT 只能配合 null 使用
		if ((upperOperator === "IS" || upperOperator === "IS NOT") && value !== null) {
			throw new Error(`Operator "${operator}" requires the value to be null`);
		}

		this.#query.having.push({
			type: "condition",
			column,
			operator,
			value,
			connector: "AND",
		});

		if (upperOperator !== "IS" && upperOperator !== "IS NOT") {
			this.#params.push(value);
		}

		return this;
	}

	/**
	 * 添加原始 HAVING 条件（高级用户逃生通道）
	 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入 expression 参数。
	 * @param {string} expression - 原始 SQL 条件表达式
	 * @param {any[]} [params=[]] - 与表达式中占位符对应的参数数组
	 * @returns {SQLBuilder}
	 * @example
	 * sql.groupBy('category').havingRaw('COUNT(*) > 5');
	 * sql.groupBy('status').havingRaw('SUM(amount) > ?', [1000]);
	 */
	havingRaw(expression, params = []) {
		if (typeof expression !== "string" || expression.length === 0) {
			throw new Error("havingRaw requires a non-empty string expression");
		}

		const placeholderCount = (expression.match(/\?/g) || []).length;
		if (placeholderCount !== params.length) {
			throw new Error(`havingRaw: expression has ${placeholderCount} placeholder(s) but ${params.length} param(s) were provided`);
		}

		this.#query.having.push({
			type: "raw",
			expression,
			connector: "AND",
		});
		this.#params.push(...params);

		return this;
	}

	/**
	 * 设置查询限制数量
	 * @param {number} number - 限制数量
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 number 不是正整数时抛出错误
	 * @example
	 * sql.limit(10); // 限制返回10条记录
	 */
	limit(number) {
		if (!Number.isInteger(number) || number <= 0) {
			throw new Error("Limit must be a positive integer");
		}
		this.#query.limit = number;
		return this;
	}

	/**
	 * 设置查询偏移量
	 * @param {number} number - 偏移量
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 number 不是非负整数时抛出错误
	 * @example
	 * sql.offset(20); // 跳过前20条记录
	 */
	offset(number) {
		if (!Number.isInteger(number) || number < 0) {
			throw new Error("Offset must be a non-negative integer");
		}
		this.#query.offset = number;
		return this;
	}

	/**
	 * 启用总数统计（用于分页查询）
	 * 在 SELECT 查询中添加 COUNT(*) OVER() 窗口函数来获取总数
	 * @param {string|boolean} [fieldNameOrEnabled="__total_count"] - 字段名或是否启用（false 表示禁用）
	 * @returns {SQLBuilder}
	 * @example
	 * // 基本用法
	 * const { sql, params } = sqlBuilder
	 *   .select('*')
	 *   .from('users')
	 *   .withTotal('total_count')
	 *   .limit(10)
	 *   .build();
	 *
	 * // 分页查询示例
	 * const page = 1;
	 * const pageSize = 10;
	 * const { sql, params } = sqlBuilder
	 *   .select(['id', 'name', 'email'])
	 *   .from('users')
	 *   .where('status', 'active')
	 *   .withTotal('total_count')
	 *   .limit(pageSize)
	 *   .offset((page - 1) * pageSize)
	 *   .build();
	 *
	 * // 禁用总数统计
	 * sqlBuilder.withTotal(false);
	 */
	withTotal(fieldNameOrEnabled = "__total_count") {
		if (fieldNameOrEnabled === false) {
			this.#query.withTotal = undefined;
		} else {
			this.#query.withTotal = fieldNameOrEnabled === true ? "__total_count" : fieldNameOrEnabled;
		}
		return this;
	}

	/**
	 * 构建 UPSERT 查询（INSERT ... ON DUPLICATE KEY UPDATE）
	 * 适用于 MySQL / MariaDB。
	 * 注意：使用 VALUES(col) 语法的字符串数组和默认模式在 MySQL 8.0.20+ 中已弃用；
	 * 对于 MySQL 9.0+，请改用显式更新数据对象（第三个参数传入对象）。
	 * @param {string} table - 表名
	 * @param {Object} insertData - 要插入的数据对象
	 * @param {string[]|Object} [updateData] - 冲突时要更新的列名数组，或显式更新数据对象（值可以是普通值或 RawExpression）。
	 *   若为字符串数组，则使用 VALUES(col) 引用插入值；
	 *   若为对象，则使用对象中指定的值（支持 RawExpression）；
	 *   若省略，则更新 insertData 中的所有列（使用 VALUES(col)）。
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 insertData 为空对象时抛出错误
	 * @example
	 * // 更新所有插入列（使用 VALUES(col)）
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' });
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `email` = VALUES(`email`)
	 *
	 * // 只更新指定列
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' }, ['name']);
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)
	 *
	 * // 使用显式更新数据（推荐用于 MySQL 8.0.20+）
	 * sql.upsert('users', { name: 'John', email: 'john@example.com' }, { name: 'John Updated' });
	 * // INSERT INTO `users` (`name`, `email`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name` = ?
	 */
	upsert(table, insertData, updateData = undefined) {
		this.#validateIdentifier(table);

		if (!insertData || typeof insertData !== "object" || Object.keys(insertData).length === 0) {
			throw new Error("Upsert insert data cannot be empty");
		}

		// 转义插入列名
		const escapedInsertData = {};
		Object.keys(insertData).forEach((key) => {
			this.#validateIdentifier(key);
			escapedInsertData[this.#escapeIdentifier(key)] = insertData[key];
		});

		// 处理更新数据
		let escapedUpdateData;
		if (updateData === undefined) {
			// 默认：用 VALUES(col) 更新所有插入列
			escapedUpdateData = null;
		} else if (Array.isArray(updateData)) {
			// 字符串数组：用 VALUES(col) 更新指定列
			if (updateData.length === 0) {
				throw new Error("Upsert update columns cannot be empty");
			}
			escapedUpdateData = updateData.map((col) => {
				this.#validateIdentifier(col);
				return this.#escapeIdentifier(col);
			});
		} else if (typeof updateData === "object" && updateData !== null) {
			// 对象：使用显式值（支持 RawExpression）
			const entries = Object.entries(updateData).filter(([_key, value]) => value !== undefined);
			if (entries.length === 0) {
				throw new Error("Upsert update data cannot be empty");
			}
			escapedUpdateData = {};
			entries.forEach(([key, value]) => {
				this.#validateIdentifier(key);
				escapedUpdateData[this.#escapeIdentifier(key)] = value;
			});
		} else {
			throw new Error("Upsert update data must be an array of column names or an object");
		}

		this.#query.type = "UPSERT";
		this.#query.table = this.#escapeIdentifier(table);
		this.#query.values = escapedInsertData;
		this.#query.upsertUpdate = escapedUpdateData;

		// 添加插入参数
		this.#params.push(...Object.values(insertData));

		// 若是显式对象，添加更新参数（排除 RawExpression 和 null）
		if (escapedUpdateData !== null && !Array.isArray(escapedUpdateData)) {
			Object.values(escapedUpdateData).forEach((value) => {
				if (!(value instanceof RawExpression) && value !== null) {
					this.#params.push(value);
				}
			});
		}

		return this;
	}

	/**
	 * 构建 INSERT 查询
	 * @param {string} table - 表名
	 * @param {Object|Object[]} data - 要插入的数据对象，或数据对象数组（批量插入）
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 data 为空对象或空数组时抛出错误
	 * @example
	 * sql.insert('users', { name: 'John', age: 25, email: 'john@example.com' });
	 * sql.insert('users', [{ name: 'John', age: 25 }, { name: 'Jane', age: 30 }]);
	 */
	insert(table, data) {
		this.#validateIdentifier(table);

		if (!data || typeof data !== "object") {
			throw new Error("Insert data cannot be empty");
		}

		const rows = Array.isArray(data) ? data : [data];

		if (rows.length === 0) {
			throw new Error("Insert data cannot be empty");
		}

		for (const row of rows) {
			if (!row || typeof row !== "object" || Object.keys(row).length === 0) {
				throw new Error("Insert data cannot be empty");
			}
		}

		// 转义所有列名（以第一行为准）
		const firstRow = rows[0];
		const columnKeys = Object.keys(firstRow);

		// 验证所有行的列名与第一行一致
		if (rows.length > 1) {
			for (let i = 1; i < rows.length; i++) {
				const rowKeys = Object.keys(rows[i]);
				if (rowKeys.length !== columnKeys.length || !columnKeys.every((k) => Object.prototype.hasOwnProperty.call(rows[i], k))) {
					throw new Error("All rows in a batch insert must have the same columns");
				}
			}
		}

		const escapedData = {};
		columnKeys.forEach((key) => {
			this.#validateIdentifier(key);
			escapedData[this.#escapeIdentifier(key)] = firstRow[key];
		});

		this.#query.type = "INSERT";
		this.#query.table = this.#escapeIdentifier(table);
		this.#query.values = escapedData;

		if (rows.length === 1) {
			this.#params.push(...columnKeys.map((k) => firstRow[k]));
		} else {
			// 批量插入：存储所有行的数据，params 按列顺序（以第一行列名为准）展平
			this.#query.insertRows = rows;
			for (const row of rows) {
				this.#params.push(...columnKeys.map((k) => row[k]));
			}
		}

		return this;
	}

	/**
	 * 构建 UPDATE 查询，设置目标表
	 * @param {string} table - 表名
	 * @returns {SQLBuilder}
	 * @example
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 */
	update(table) {
		this.#validateIdentifier(table);
		this.#query.type = "UPDATE";
		this.#query.table = this.#escapeIdentifier(table);
		return this;
	}

	/**
	 * 设置 UPDATE 查询的更新数据
	 * @param {Object|string} data - 要更新的数据对象（值可以是普通值或 RawExpression），或者列名（配合第二个参数使用）
	 * @param {any} [value] - 列的值（普通值或 RawExpression），当第一个参数为列名时使用。
	 *   如需嵌入原始 SQL 表达式，请传入 raw() 的返回值。
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 data 为空对象时抛出错误
	 * @example
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 * sql.update('users').set('age', 26).where('id', 1);
	 * sql.update('users').set('age', raw('age + 1')).where('id', 1);
	 * sql.update('users').set({ age: raw('age + 1'), updated_at: new Date() }).where('id', 1);
	 */
	set(data, value = undefined) {
		// Shorthand: set(column, value)
		if (typeof data === "string" && value !== undefined) {
			return this.set({ [data]: value });
		}

		if (!data || typeof data !== "object") {
			throw new Error("Update data cannot be empty");
		}

		const entries = Object.entries(data).filter(([, value]) => value !== undefined);
		if (entries.length === 0) {
			throw new Error("Update data cannot be empty");
		}

		// 转义所有列名，区分普通值和原始表达式
		const escapedData = {};
		entries.forEach(([key, value]) => {
			this.#validateIdentifier(key);
			escapedData[this.#escapeIdentifier(key)] = value;
		});

		Object.assign(this.#query.set, escapedData);
		this.#setParams = Object.keys(this.#query.set)
			.map((k) => this.#query.set[k])
			.filter((v) => !(v instanceof RawExpression) && v !== null);
		return this;
	}

	/**
	 * 构建 DELETE 查询
	 * @param {string} [table] - 表名（可选）
	 * @returns {SQLBuilder}
	 * @example
	 * sql.delete('users').where('status', 'inactive');
	 * sql.delete().from('users').where('id', 1); // 链式调用方式
	 */
	delete(table = null) {
		this.#query.type = "DELETE";
		if (table) {
			this.#validateIdentifier(table);
			this.#query.table = this.#escapeIdentifier(table);
		}
		return this;
	}

	/**
	 * 为 INSERT/UPDATE/DELETE 查询添加 RETURNING 子句，指定返回的列
	 * @param {...string} columns - 要返回的列名，传入 '*' 返回所有列
	 * @returns {SQLBuilder}
	 * @throws {Error} 当列名格式非法时抛出错误
	 * @example
	 * sql.insert('users', { name: 'John' }).returning('id', 'name');
	 * // INSERT INTO `users` (`name`) VALUES (?) RETURNING `id`, `name`
	 * sql.update('users').set({ name: 'Jane' }).where('id', 1).returning('*');
	 * // UPDATE `users` SET `name` = ? WHERE `id` = ? RETURNING *
	 * sql.delete('users').where('id', 1).returning('id');
	 * // DELETE FROM `users` WHERE `id` = ? RETURNING `id`
	 */
	returning(...columns) {
		if (columns.length === 0) {
			throw new Error("RETURNING clause requires at least one column");
		}
		this.#query.returning = columns.map((col) => {
			if (col === "*") return "*";
			this.#validateIdentifier(col);
			return this.#escapeIdentifier(col);
		});
		return this;
	}

	/**
	 * 允许的锁定模式白名单
	 * @private
	 * @static
	 * @type {Set<string>}
	 */
	static #ALLOWED_LOCK_MODES = new Set(["FOR UPDATE", "FOR SHARE", "LOCK IN SHARE MODE"]);

	/**
	 * 为 SELECT 查询添加行级锁定子句
	 * @param {'FOR UPDATE'|'FOR SHARE'|'LOCK IN SHARE MODE'} mode - 锁定模式
	 * @returns {SQLBuilder}
	 * @throws {Error} 当锁定模式不合法时抛出错误
	 * @example
	 * sql.select('*').from('users').where('id', 1).lock('FOR UPDATE');
	 * // SELECT * FROM `users` WHERE `id` = ? FOR UPDATE
	 */
	lock(mode) {
		if (typeof mode !== "string") {
			throw new Error(`Invalid lock mode: ${mode}. Allowed modes: FOR UPDATE, FOR SHARE, LOCK IN SHARE MODE`);
		}
		const upperMode = mode.toUpperCase();
		if (!SQLBuilder.#ALLOWED_LOCK_MODES.has(upperMode)) {
			throw new Error(`Invalid lock mode: ${mode}. Allowed modes: FOR UPDATE, FOR SHARE, LOCK IN SHARE MODE`);
		}
		this.#query.lock = upperMode;
		return this;
	}

	/**
	 * 添加 UNION 子句，合并另一个 SELECT 查询的结果（去重）
	 * @param {SQLBuilder} builder - 另一个 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * sqlBuilder.select('id', 'name').from('users').union(
	 *   new SQLBuilder().select('id', 'name').from('admins')
	 * );
	 * // SELECT `id`, `name` FROM `users` UNION SELECT `id`, `name` FROM `admins`
	 */
	union(builder) {
		if (!(builder instanceof SQLBuilder)) {
			throw new Error("union() requires a SQLBuilder instance");
		}
		this.#query.unions.push({ type: "UNION", builder });
		return this;
	}

	/**
	 * 添加 UNION ALL 子句，合并另一个 SELECT 查询的结果（保留重复行）
	 * @param {SQLBuilder} builder - 另一个 SQLBuilder 实例
	 * @returns {SQLBuilder}
	 * @throws {Error} 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * sqlBuilder.select('id', 'name').from('users').unionAll(
	 *   new SQLBuilder().select('id', 'name').from('admins')
	 * );
	 * // SELECT `id`, `name` FROM `users` UNION ALL SELECT `id`, `name` FROM `admins`
	 */
	unionAll(builder) {
		if (!(builder instanceof SQLBuilder)) {
			throw new Error("unionAll() requires a SQLBuilder instance");
		}
		this.#query.unions.push({ type: "UNION ALL", builder });
		return this;
	}

	/**
	 * 构建 SQL 查询对象
	 * @returns {{sql: string, params: any[]}} 包含 SQL 语句和参数的对象
	 * @throws {Error} 当表名为空或查询类型不支持时抛出错误
	 * @example
	 * const { sql, params } = sqlBuilder.build();
	 * console.log(sql); // "SELECT * FROM `users` WHERE `age` > ?"
	 * console.log(params); // [18]
	 */
	build() {
		if (!this.#query.table) {
			throw new Error("Table name is required");
		}

		// 安全验证
		this.#validateFinalQuery();

		switch (this.#query.type) {
			case "SELECT":
				return this.#buildSelect();
			case "INSERT":
				return this.#buildInsert();
			case "UPSERT":
				return this.#buildUpsert();
			case "UPDATE":
				return this.#buildUpdate();
			case "DELETE":
				return this.#buildDelete();
			default:
				throw new Error(`Unsupported query type: ${this.#query.type}`);
		}
	}

	/**
	 * 最终查询安全验证
	 * @private
	 * @throws {Error} 当查询不安全时抛出错误
	 */
	#validateFinalQuery() {
		// 防止没有 WHERE 条件的 UPDATE 和 DELETE（安全措施）
		if ((this.#query.type === "UPDATE" || this.#query.type === "DELETE") && this.#query.where.length === 0) {
			throw new Error(`Safety check: ${this.#query.type} query requires WHERE clause to prevent accidental data loss`);
		}
	}

	/**
	 * 递归构建 WHERE 条件字符串（不含前缀 "WHERE"）
	 * @private
	 * @param {Array} conditions - 条件数组
	 * @returns {string} 条件字符串
	 */
	#buildWhereConditions(conditions) {
		return conditions
			.map((condition, index) => {
				const connector = index === 0 ? "" : condition.connector + " ";

				if (condition.type === "group") {
					const nested = this.#buildWhereConditions(condition.conditions);
					return `${connector}(${nested})`;
				}

				if (condition.type === "raw") {
					return `${connector}${condition.expression}`;
				}

				if (condition.type === "exists") {
					const { sql: subSql, params: subParams } = condition.subquery.build();
					this.#params.push(...subParams);
					return `${connector}${condition.operator} (${subSql})`;
				}

				const valuePlaceholder =
					condition.operator === "IS" || condition.operator === "IS NOT"
						? "NULL"
						: condition.operator === "IN" || condition.operator === "NOT IN" || condition.operator === "BETWEEN"
							? condition.value
							: "?";
				return `${connector}${condition.column} ${condition.operator} ${valuePlaceholder}`;
			})
			.join(" ");
	}

	/**
	 * 构建 HAVING 条件字符串
	 * @private
	 * @param {Array} conditions - HAVING 条件数组
	 * @returns {string} HAVING 条件字符串
	 */
	#buildHavingConditions(conditions) {
		return conditions
			.map((condition, index) => {
				const connector = index === 0 ? "" : condition.connector + " ";

				if (condition.type === "raw") {
					return `${connector}${condition.expression}`;
				}

				const valuePlaceholder =
					condition.operator.toUpperCase() === "IS" || condition.operator.toUpperCase() === "IS NOT"
						? "NULL"
						: "?";
				return `${connector}${condition.column} ${condition.operator} ${valuePlaceholder}`;
			})
			.join(" ");
	}

	/**
	 * 构建 RETURNING 子句字符串（不含前缀空格）
	 * @private
	 * @returns {string|null} RETURNING 子句字符串，若无 RETURNING 则返回 null
	 */
	#buildReturningClause() {
		if (!this.#query.returning) return null;
		return `RETURNING ${this.#query.returning.join(", ")}`;
	}

	/**
	 * 构建 SELECT 查询
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildSelect() {
		const parts = [];

		// SELECT 部分（处理总数统计）
		const selectKeyword = `SELECT ${this.#query.distinct ? "DISTINCT " : ""}`;
		if (this.#query.withTotal) {
			parts.push(`${selectKeyword}${this.#query.columns.join(", ")}, COUNT(*) OVER() AS ${this.#query.withTotal}`);
		} else {
			parts.push(`${selectKeyword}${this.#query.columns.join(", ")}`);
		}

		// FROM 部分（处理表别名）
		const fromTable = this.#query.tableAlias ? `${this.#query.table} ${this.#query.tableAlias}` : this.#query.table;
		parts.push(`FROM ${fromTable}`);

		// JOIN 部分
		if (this.#query.joins.length > 0) {
			this.#query.joins.forEach((join) => {
				if (join.conditions) {
					const onClause = join.conditions
						.map((c, i) => `${i === 0 ? "" : c.connector + " "}${c.first} ${c.operator} ${c.second}`)
						.join(" ");
					parts.push(`${join.type} JOIN ${join.table} ON ${onClause}`);
				} else if (join.condition) {
					parts.push(
						`${join.type} JOIN ${join.table} ON ${join.condition.first} ${join.condition.operator} ${join.condition.second}`,
					);
				} else {
					parts.push(`${join.type} JOIN ${join.table}`);
				}
			});
		}

		// WHERE 部分
		if (this.#query.where.length > 0) {
			parts.push(`WHERE ${this.#buildWhereConditions(this.#query.where)}`);
		}

		// GROUP BY 部分
		if (this.#query.groupBy.length > 0) {
			parts.push(`GROUP BY ${this.#query.groupBy.join(", ")}`);
		}

		// HAVING 部分
		if (this.#query.having.length > 0) {
			parts.push(`HAVING ${this.#buildHavingConditions(this.#query.having)}`);
		}

		// ORDER BY 部分
		if (this.#query.orderBy.length > 0) {
			const orderClauses = this.#query.orderBy.map((order) => `${order.column} ${order.direction}`);
			parts.push(`ORDER BY ${orderClauses.join(", ")}`);
		}

		// LIMIT 和 OFFSET 部分
		if (this.#query.limit !== null) {
			parts.push(`LIMIT ${this.#query.limit}`);
		}

		if (this.#query.offset !== null) {
			parts.push(`OFFSET ${this.#query.offset}`);
		}

		// LOCK 部分
		if (this.#query.lock !== null) {
			parts.push(this.#query.lock);
		}

		let sql = parts.join(" ");

		// UNION / UNION ALL 部分
		const allParams = [...this.#params];
		for (const { type, builder } of this.#query.unions) {
			const unionResult = builder.build();
			sql += ` ${type} ${unionResult.sql}`;
			allParams.push(...unionResult.params);
		}

		return new BuildResult(sql, allParams);
	}

	/**
	 * 构建 INSERT 查询
	 * @private
	 * @returns {BuildResult}
	 */
	#buildInsert() {
		const columns = Object.keys(this.#query.values);
		const placeholders = this.#buildPlaceholders(columns.length);

		let valuesList;
		if (this.#query.insertRows && this.#query.insertRows.length > 1) {
			valuesList = this.#query.insertRows.map(() => `(${placeholders})`).join(", ");
		} else {
			valuesList = `(${placeholders})`;
		}

		const parts = [`INSERT INTO ${this.#query.table} (${columns.join(", ")}) VALUES ${valuesList}`];

		const returning = this.#buildReturningClause();
		if (returning) parts.push(returning);

		return new BuildResult(parts.join(" "), this.#params);
	}

	/**
	 * 构建 UPSERT 查询（INSERT ... ON DUPLICATE KEY UPDATE）
	 * @private
	 * @returns {{sql: string, params: any[]}}
	 */
	#buildUpsert() {
		const columns = Object.keys(this.#query.values);
		const placeholders = this.#buildPlaceholders(columns.length);

		const updateData = this.#query.upsertUpdate;
		let updateClauses;

		if (updateData === null) {
			// 默认：用 VALUES(col) 更新所有插入列
			updateClauses = columns.map((col) => `${col} = VALUES(${col})`).join(", ");
		} else if (Array.isArray(updateData)) {
			// 字符串数组：用 VALUES(col) 更新指定列
			updateClauses = updateData.map((col) => `${col} = VALUES(${col})`).join(", ");
		} else {
			// 对象：使用显式值（支持 RawExpression）
			updateClauses = Object.entries(updateData)
				.map(([col, value]) => {
					if (value instanceof RawExpression) {
						return `${col} = ${value.expression}`;
					}
					if (value === null) {
						return `${col} = NULL`;
					}
					return `${col} = ?`;
				})
				.join(", ");
		}

		const sql = `INSERT INTO ${this.#query.table} (${columns.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;

		return new BuildResult(sql, this.#params);
	}

	/**
	 * 构建 UPDATE 查询
	 * @private
	 * @returns {BuildResult}
	 */
	#buildUpdate() {
		if (Object.keys(this.#query.set).length === 0) {
			throw new Error("Update data cannot be empty");
		}

		const setClauses = Object.keys(this.#query.set)
			.map((column) => {
				const value = this.#query.set[column];
				if (value instanceof RawExpression) {
					return `${column} = ${value.expression}`;
				}
				if (value === null) {
					return `${column} = NULL`;
				}
				return `${column} = ?`;
			})
			.join(", ");

		const parts = [`UPDATE ${this.#query.table} SET ${setClauses}`];

		// WHERE 部分
		if (this.#query.where.length > 0) {
			parts.push(`WHERE ${this.#buildWhereConditions(this.#query.where)}`);
		}

		// RETURNING 部分
		const returning = this.#buildReturningClause();
		if (returning) parts.push(returning);

		return new BuildResult(parts.join(" "), [...this.#setParams, ...this.#params]);
	}

	/**
	 * 构建 DELETE 查询
	 * @private
	 * @returns {BuildResult}
	 */
	#buildDelete() {
		const parts = [`DELETE FROM ${this.#query.table}`];

		// WHERE 部分
		if (this.#query.where.length > 0) {
			parts.push(`WHERE ${this.#buildWhereConditions(this.#query.where)}`);
		}

		// RETURNING 部分
		const returning = this.#buildReturningClause();
		if (returning) parts.push(returning);

		return new BuildResult(parts.join(" "), this.#params);
	}

	/**
	 * 获取格式化的 SQL 字符串（用于调试，不应用于实际查询）
	 * @returns {string} 格式化的 SQL 字符串
	 * @example
	 * console.log(sqlBuilder.toString());
	 * // "SELECT * FROM `users` WHERE `age` > 18 AND `status` = 'active'"
	 */
	toString() {
		return this.build().toString();
	}

	/**
	 * 获取当前查询的参数数组
	 * @returns {any[]} 参数数组
	 * @example
	 * const params = sqlBuilder.getParams();
	 */
	getParams() {
		return this.#params.slice();
	}

	/**
	 * 获取当前查询的 SQL 字符串（未构建）
	 * @returns {string} 当前查询类型的描述
	 * @example
	 * console.log(sqlBuilder.getQueryType()); // "SELECT"
	 */
	getQueryType() {
		return this.#query.type;
	}
}

/**
 * SQL 事务构建器
 * 将多个 SQLBuilder 查询包装在事务中，支持 SAVEPOINT 操作
 * @class Transaction
 * @example
 * const transaction = new Transaction();
 * const result = transaction
 *   .add(new SQLBuilder().insert('users', { name: 'John' }))
 *   .add(new SQLBuilder().update('accounts').set({ balance: 100 }).where('id', 1))
 *   .build();
 * console.log(result.sql);
 * // BEGIN;
 * // INSERT INTO `users` (`name`) VALUES (?);
 * // UPDATE `accounts` SET `balance` = ? WHERE `id` = ?;
 * // COMMIT;
 */
class Transaction {
	/**
	 * Regex pattern for savepoint name validation
	 * @private
	 * @static
	 */
	static #SAVEPOINT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

	/**
	 * Valid BEGIN transaction types
	 * @private
	 * @static
	 */
	static #VALID_TYPES = ["DEFERRED", "IMMEDIATE", "EXCLUSIVE"];

	/**
	 * @private
	 * @type {string|null}
	 */
	#beginType = null;

	/**
	 * @private
	 * @type {Array<{type: string, builder?: SQLBuilder, name?: string}>}
	 */
	#statements = [];

	/**
	 * 创建 Transaction 实例
	 * @param {string} [type] - 事务类型，可选值为 DEFERRED、IMMEDIATE、EXCLUSIVE
	 * @throws {Error} 当类型不合法时抛出错误
	 * @example
	 * new Transaction('DEFERRED');
	 * new Transaction('IMMEDIATE');
	 * new Transaction('EXCLUSIVE');
	 */
	constructor(type) {
		if (type !== undefined) {
			if (typeof type !== "string") {
				throw new Error(`Invalid transaction type: ${type}. Must be one of: ${Transaction.#VALID_TYPES.join(", ")}`);
			}
			const upperType = type.toUpperCase();
			if (!Transaction.#VALID_TYPES.includes(upperType)) {
				throw new Error(`Invalid transaction type: ${type}. Must be one of: ${Transaction.#VALID_TYPES.join(", ")}`);
			}
			this.#beginType = upperType;
		}
	}

	/**
	 * 验证 SAVEPOINT 名称是否合法
	 * @private
	 * @param {string} name - SAVEPOINT 名称
	 * @throws {Error} 当名称不合法时抛出错误
	 */
	#validateSavepointName(name) {
		if (typeof name !== "string" || !Transaction.#SAVEPOINT_PATTERN.test(name)) {
			throw new Error(`Invalid savepoint name: ${name}`);
		}
	}

	/**
	 * 添加一个 SQLBuilder 查询到事务中
	 * @param {SQLBuilder} builder - SQLBuilder 实例
	 * @returns {Transaction}
	 * @throws {Error} 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * transaction.add(new SQLBuilder().insert('users', { name: 'John' }));
	 */
	add(builder) {
		if (!(builder instanceof SQLBuilder)) {
			throw new Error("Transaction.add() requires a SQLBuilder instance");
		}
		this.#statements.push({ type: "query", builder });
		return this;
	}

	/**
	 * 添加 SAVEPOINT 语句
	 * @param {string} name - SAVEPOINT 名称
	 * @returns {Transaction}
	 * @example
	 * transaction.savepoint('sp1');
	 */
	savepoint(name) {
		this.#validateSavepointName(name);
		this.#statements.push({ type: "savepoint", name });
		return this;
	}

	/**
	 * 添加 RELEASE SAVEPOINT 语句
	 * @param {string} name - SAVEPOINT 名称
	 * @returns {Transaction}
	 * @example
	 * transaction.releaseSavepoint('sp1');
	 */
	releaseSavepoint(name) {
		this.#validateSavepointName(name);
		this.#statements.push({ type: "release_savepoint", name });
		return this;
	}

	/**
	 * 添加 ROLLBACK TO SAVEPOINT 语句
	 * @param {string} name - SAVEPOINT 名称
	 * @returns {Transaction}
	 * @example
	 * transaction.rollbackTo('sp1');
	 */
	rollbackTo(name) {
		this.#validateSavepointName(name);
		this.#statements.push({ type: "rollback_to", name });
		return this;
	}

	/**
	 * 构建事务 SQL
	 * @returns {BuildResult} 包含完整事务 SQL 和参数的对象
	 * @example
	 * const { sql, params } = transaction.build();
	 * console.log(transaction.build().toString()); // 格式化后的完整事务 SQL
	 */
	build() {
		const parts = [this.#beginType ? `BEGIN ${this.#beginType}` : "BEGIN"];
		const params = [];

		for (const stmt of this.#statements) {
			if (stmt.type === "query") {
				const result = stmt.builder.build();
				parts.push(result.sql);
				params.push(...result.params);
			} else if (stmt.type === "savepoint") {
				parts.push(`SAVEPOINT ${stmt.name}`);
			} else if (stmt.type === "release_savepoint") {
				parts.push(`RELEASE SAVEPOINT ${stmt.name}`);
			} else if (stmt.type === "rollback_to") {
				parts.push(`ROLLBACK TO SAVEPOINT ${stmt.name}`);
			}
		}

		parts.push("COMMIT");

		return new BuildResult(parts.join(";\n") + ";", params);
	}
}

export { SQLBuilder, Transaction, RawExpression, BuildResult, raw };
export default SQLBuilder;
