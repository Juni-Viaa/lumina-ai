/**
 * TypeScript interfaces untuk fitur Monitoring Token dan Query Logs.
 */

export interface MonitoringLimits {
    requests_per_minute: number;
    daily_token_limit_input: number;
    daily_token_limit_output: number;
}

export interface UserTokenSummary {
    user_id: number;
    username: string;
    email: string;
    role: string;
    date: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    request_count: number;
    input_percentage: number;
    output_percentage: number;
}

export interface TokenSummary {
    date: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_requests: number;
    active_users_count: number;
    limits: MonitoringLimits;
    users: UserTokenSummary[];
}

export interface DailyTrend {
    date: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    request_count: number;
}

export interface TopUser {
    user_id: number;
    username: string;
    email: string;
    role: string;
    total_tokens: number;
    request_count: number;
    input_tokens: number;
    output_tokens: number;
}

export interface ChartsData {
    period_days: number;
    start_date: string;
    end_date: string;
    daily_trends: DailyTrend[];
    top_users: TopUser[];
}

export interface QueryLogItem {
    id: number;
    user_id: number | null;
    user_email: string;
    user_username: string;
    user_role: string;
    query_id: number | null;
    query_title: string | null;
    query_text: string | null;
    endpoint: string;
    input_tokens: number;
    output_tokens: number;
    status_code: number;
    response_time_ms: number | null;
    error_message: string | null;
    created_at: string;
}

export interface PaginatedQueryLogs {
    count: number;
    next: string | null;
    previous: string | null;
    results: QueryLogItem[];
}
