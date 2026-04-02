/**
 * SQL 查询构建结果
 */
interface BuildResult {
	/** 生成的 SQL 语句 */
	sql: string;
	/** 查询参数数组 */
	params: any[];
}

/**
 * 原始 SQL 表达式包装器，用于在 UPDATE 语句中嵌入不参数化的表达式
 * @example
 * ```typescript
 * sqlBuilder.update('users', { age: raw('age + 1') }).where('id', 1);
 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
 * ```
 */
declare class RawExpression {
	/** 原始 SQL 表达式字符串 */
	readonly expression: string;
	/**
	 * @param expression - 原始 SQL 表达式（不会被参数化，请勿传入用户输入）
	 */
	constructor(expression: string);
}

/**
 * 创建一个原始 SQL 表达式，用于在 UPDATE 语句中嵌入不参数化的列表达式。
 * 注意：表达式会直接嵌入 SQL，请勿将用户输入传入此函数。
 * @param expression - 原始 SQL 表达式
 * @returns RawExpression 实例
 * @example
 * ```typescript
 * sqlBuilder.update('users', { age: raw('age + 1') }).where('id', 1);
 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
 * ```
 */
declare function raw(expression: string): RawExpression;

/**
 * 安全的 SQL 查询构建器
 * 提供全面的 SQL 注入防护，使用参数化查询和标识符验证
 * @example
 * ```typescript
 * const sql = new SQLBuilder();
 * const query = sql.select('*').from('users').where('age', '>', 18).build();
 * console.log(query.sql); // SELECT * FROM `users` WHERE `age` > ?
 * console.log(query.params); // [18]
 * ```
 */
declare class SQLBuilder {
	/**
	 * 创建 SQLBuilder 实例
	 * @example
	 * ```typescript
	 * const sql = new SQLBuilder();
	 * ```
	 */
	constructor();

	/**
	 * 设置标识符白名单
	 * @param identifiers - 允许的标识符列表
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.setAllowedIdentifiers(['users', 'id', 'name', 'email']);
	 * ```
	 */
	setAllowedIdentifiers(identifiers: string[]): this;

	/**
	 * 重置构建器状态
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.reset().select('*').from('users');
	 * ```
	 */
	reset(): this;

	/**
	 * 设置 SELECT 查询的列
	 * @param columns - 要查询的列名，默认为 ['*']
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('id', 'name');
	 * sql.select(['id', 'name', 'email']);
	 * sql.select('*'); // 查询所有列
	 * ```
	 */
	select(columns?: string | string[]): this;

	/**
	 * 设置查询的表名
	 * @param table - 表名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.from('users');
	 * sql.from('users u'); // 使用表别名
	 * ```
	 */
	from(table: string): this;

	/**
	 * 添加 WHERE 条件（分组回调形式，生成括号嵌套）
	 * @param callback - 分组回调，接收子构建器以定义括号内的条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('age', '>', 18).where(q => q.where('status', 'active').orWhere('status', 'pending'));
	 * // WHERE `age` > ? AND (`status` = ? OR `status` = ?)
	 * ```
	 */
	where(callback: (builder: SQLBuilder) => void): this;

	/**
	 * 添加 WHERE 条件
	 * @param column - 列名
	 * @param operator - 操作符，默认为 '='
	 * @param value - 值（当只有两个参数时，第二个参数作为值）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('age', '>', 18);
	 * sql.where('name', 'John'); // 默认使用 = 操作符
	 * sql.where('status', 'IS', null);
	 * ```
	 */
	where(column: string, operator: string, value?: any): this;

	/**
	 * 添加 OR WHERE 条件（分组回调形式，生成括号嵌套）
	 * @param callback - 分组回调，接收子构建器以定义括号内的条件
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('type', 'vip').orWhere(q => q.where('age', '>', 60).where('member', true));
	 * // WHERE `type` = ? OR (`age` > ? AND `member` = ?)
	 * ```
	 */
	orWhere(callback: (builder: SQLBuilder) => void): this;

	/**
	 * 添加 OR WHERE 条件
	 * @param column - 列名
	 * @param operator - 操作符，默认为 '='
	 * @param value - 值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.where('status', 'active').orWhere('status', 'pending');
	 * ```
	 */
	orWhere(column: string, operator: string, value?: any): this;

	/**
	 * 添加 WHERE IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @throws 当 values 不是数组或为空时抛出错误
	 * @example
	 * ```typescript
	 * sql.whereIn('status', ['active', 'pending', 'inactive']);
	 * ```
	 */
	whereIn(column: string, values: any[]): this;

	/**
	 * 添加 WHERE NOT IN 条件
	 * @param column - 列名
	 * @param values - 值数组
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNotIn('role', ['admin', 'superuser']);
	 * ```
	 */
	whereNotIn(column: string, values: any[]): this;

	/**
	 * 添加 LIKE 条件
	 * @param column - 列名
	 * @param value - 搜索值
	 * @param wildcard - 是否自动添加 % 通配符，默认为 true
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereLike('name', 'John'); // 搜索包含 'John' 的名称
	 * sql.whereLike('email', '@example.com', false); // 精确匹配结尾
	 * ```
	 */
	whereLike(column: string, value: string, wildcard?: boolean): this;

	/**
	 * 添加 BETWEEN 条件
	 * @param column - 列名
	 * @param start - 范围开始值
	 * @param end - 范围结束值
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereBetween('age', 18, 65);
	 * sql.whereBetween('created_at', '2023-01-01', '2023-12-31');
	 * ```
	 */
	whereBetween(column: string, start: any, end: any): this;

	/**
	 * 添加 IS NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNull('deleted_at');
	 * ```
	 */
	whereNull(column: string): this;

	/**
	 * 添加 IS NOT NULL 条件
	 * @param column - 列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.whereNotNull('email');
	 * ```
	 */
	whereNotNull(column: string): this;

	/**
	 * 添加 INNER JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.join('posts', 'users.id', '=', 'posts.user_id');
	 * ```
	 */
	join(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加 LEFT JOIN 连接
	 * @param table - 要连接的表名
	 * @param first - 第一个连接条件列
	 * @param operator - 操作符
	 * @param second - 第二个连接条件列
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');
	 * ```
	 */
	leftJoin(table: string, first: string, operator: string, second: string): this;

	/**
	 * 添加排序条件
	 * @param column - 排序列名，或多列排序数组 `[column, direction][]`
	 * @param direction - 排序方向，默认为 'ASC'（单列时有效）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.orderBy('created_at', 'DESC');
	 * sql.orderBy('name', 'ASC');
	 * sql.orderBy([['status', 'ASC'], ['created_at', 'DESC']]); // 多列排序
	 * ```
	 */
	orderBy(column: string, direction?: "ASC" | "DESC"): this;
	orderBy(columns: Array<[string, "ASC" | "DESC"]>): this;

	/**
	 * 添加分组条件
	 * @param columns - 分组列名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.groupBy('category');
	 * sql.groupBy(['category', 'status']);
	 * ```
	 */
	groupBy(columns: string | string[]): this;

	/**
	 * 统计总数
	 * @param fieldName - 统计出来之后的字段名称
	 */
	withTotal(fieldName: string): this;

	/**
	 * 设置查询限制数量
	 * @param number - 限制数量
	 * @returns SQLBuilder 实例
	 * @throws 当 number 不是正整数时抛出错误
	 * @example
	 * ```typescript
	 * sql.limit(10); // 限制返回10条记录
	 * ```
	 */
	limit(number: number): this;

	/**
	 * 设置查询偏移量
	 * @param number - 偏移量
	 * @returns SQLBuilder 实例
	 * @throws 当 number 不是非负整数时抛出错误
	 * @example
	 * ```typescript
	 * sql.offset(20); // 跳过前20条记录
	 * ```
	 */
	offset(number: number): this;

	/**
	 * 构建 INSERT 查询
	 * @param table - 表名
	 * @param data - 要插入的数据对象
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.insert('users', { name: 'John', age: 25, email: 'john@example.com' });
	 * ```
	 */
	insert(table: string, data: Record<string, any>): this;

	/**
	 * 构建 UPDATE 查询，设置目标表
	 * @param table - 表名
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 * sql.update('users').set({ age: raw('age + 1') }).where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	update(table: string): this;

	/**
	 * 设置 UPDATE 查询的更新数据
	 * @param data - 要更新的数据对象（值可以是普通值或 RawExpression）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set({ name: 'Jane', age: 26 }).where('id', 1);
	 * sql.update('users').set({ age: raw('age + 1') }).where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	set(data: Record<string, any | RawExpression>): this;

	/**
	 * 设置 UPDATE 查询的更新数据（单列原始表达式简写形式）
	 * @param column - 要更新的列名
	 * @param rawExpression - 原始 SQL 表达式（直接嵌入 SQL，不会参数化，请勿传入用户输入）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.update('users').set('age', 'age + 1').where('id', 1);
	 * // UPDATE `users` SET `age` = age + 1 WHERE `id` = ?
	 * ```
	 */
	set(column: string, rawExpression: string): this;

	/**
	 * 为 SELECT 查询添加行级锁定子句
	 * @param mode - 锁定模式
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.select('*').from('users').where('id', 1).lock('FOR UPDATE');
	 * // SELECT * FROM `users` WHERE `id` = ? FOR UPDATE
	 * ```
	 */
	lock(mode: "FOR UPDATE" | "FOR SHARE" | "LOCK IN SHARE MODE"): this;

	/**
	 * 构建 DELETE 查询
	 * @param table - 表名（可选）
	 * @returns SQLBuilder 实例
	 * @example
	 * ```typescript
	 * sql.delete('users').where('status', 'inactive');
	 * sql.delete().from('users').where('id', 1); // 链式调用方式
	 * ```
	 */
	delete(table?: string): this;

	/**
	 * 构建 SQL 查询对象
	 * @returns 包含 SQL 语句和参数的对象
	 * @throws 当表名为空或查询类型不支持时抛出错误
	 * @example
	 * ```typescript
	 * const { sql, params } = sqlBuilder.build();
	 * console.log(sql); // "SELECT * FROM `users` WHERE `age` > ?"
	 * console.log(params); // [18]
	 * ```
	 */
	build(): BuildResult;

	/**
	 * 获取格式化的 SQL 字符串（用于调试，不应用于实际查询）
	 * @returns 格式化的 SQL 字符串
	 * @example
	 * ```typescript
	 * console.log(sqlBuilder.toString());
	 * // "SELECT * FROM `users` WHERE `age` > 18 AND `status` = 'active'"
	 * ```
	 */
	toString(): string;

	/**
	 * 获取当前查询的参数数组
	 * @returns 参数数组
	 * @example
	 * ```typescript
	 * const params = sqlBuilder.getParams();
	 * ```
	 */
	getParams(): any[];

	/**
	 * 获取当前查询的 SQL 字符串（未构建）
	 * @returns 当前查询类型的描述
	 * @example
	 * ```typescript
	 * console.log(sqlBuilder.getQueryType()); // "SELECT"
	 * ```
	 */
	getQueryType(): string;
}

/**
 * SQL 事务构建结果
 */
interface TransactionResult {
	/** 完整的事务 SQL 语句（包含 BEGIN 和 COMMIT） */
	sql: string;
	/** 所有查询的参数数组（按顺序合并） */
	params: any[];
}

/**
 * SQL 事务构建器
 * 将多个 SQLBuilder 查询包装在事务中，支持 SAVEPOINT 操作
 * @example
 * ```typescript
 * const transaction = new Transaction();
 * const { sql, params } = transaction
 *   .add(new SQLBuilder().insert('users', { name: 'John' }))
 *   .add(new SQLBuilder().update('accounts').set({ balance: 100 }).where('id', 1))
 *   .build();
 * // sql:
 * // BEGIN;
 * // INSERT INTO `users` (`name`) VALUES (?);
 * // UPDATE `accounts` SET `balance` = ? WHERE `id` = ?;
 * // COMMIT;
 * ```
 */
declare class Transaction {
	/**
	 * 创建 Transaction 实例
	 * @param type - 事务类型，可选值为 DEFERRED、IMMEDIATE、EXCLUSIVE
	 * @throws 当类型不合法时抛出错误
	 * @example
	 * ```typescript
	 * new Transaction('DEFERRED');
	 * new Transaction('IMMEDIATE');
	 * new Transaction('EXCLUSIVE');
	 * ```
	 */
	constructor(type?: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE");

	/**
	 * 添加一个 SQLBuilder 查询到事务中
	 * @param builder - SQLBuilder 实例
	 * @returns Transaction 实例
	 * @throws 当 builder 不是 SQLBuilder 实例时抛出错误
	 * @example
	 * ```typescript
	 * transaction.add(new SQLBuilder().insert('users', { name: 'John' }));
	 * ```
	 */
	add(builder: SQLBuilder): this;

	/**
	 * 添加 SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称（只允许字母、数字和下划线，且以字母或下划线开头）
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.savepoint('sp1');
	 * ```
	 */
	savepoint(name: string): this;

	/**
	 * 添加 RELEASE SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.releaseSavepoint('sp1');
	 * ```
	 */
	releaseSavepoint(name: string): this;

	/**
	 * 添加 ROLLBACK TO SAVEPOINT 语句
	 * @param name - SAVEPOINT 名称
	 * @returns Transaction 实例
	 * @example
	 * ```typescript
	 * transaction.rollbackTo('sp1');
	 * ```
	 */
	rollbackTo(name: string): this;

	/**
	 * 构建事务 SQL
	 * @returns 包含完整事务 SQL 语句和参数的对象
	 * @example
	 * ```typescript
	 * const { sql, params } = transaction.build();
	 * console.log(sql);
	 * // BEGIN;
	 * // INSERT INTO `users` (`name`) VALUES (?);
	 * // COMMIT;
	 * ```
	 */
	build(): TransactionResult;
}

export { SQLBuilder, Transaction, RawExpression, raw };
export default SQLBuilder;
