/**
 * Mock infrastructure for deterministic automaton tests.
 */
import type { InferenceClient, InferenceResponse, InferenceOptions, ChatMessage, ClawdClient, ExecResult, PortInfo, SandboxInfo, PricingTier, CreditTransferResult, CreateSandboxOptions, DomainSearchResult, DomainRegistration, DnsRecord, ModelInfo, AutomatonDatabase, AutomatonIdentity, AutomatonConfig, SocialClientInterface, InboxMessage } from "../types.js";
export declare class MockInferenceClient implements InferenceClient {
    private responses;
    private callIndex;
    lowComputeMode: boolean;
    calls: {
        messages: ChatMessage[];
        options?: InferenceOptions;
    }[];
    constructor(responses?: InferenceResponse[]);
    chat(messages: ChatMessage[], options?: InferenceOptions): Promise<InferenceResponse>;
    setLowComputeMode(enabled: boolean): void;
    getDefaultModel(): string;
}
export declare function noToolResponse(text?: string): InferenceResponse;
export declare function toolCallResponse(toolCalls: {
    name: string;
    arguments: Record<string, unknown>;
}[], text?: string): InferenceResponse;
export declare class MockClawdClient implements ClawdClient {
    execCalls: {
        command: string;
        timeout?: number;
    }[];
    creditsCents: number;
    files: Record<string, string>;
    exec(command: string, timeout?: number): Promise<ExecResult>;
    writeFile(path: string, content: string): Promise<void>;
    readFile(path: string): Promise<string>;
    exposePort(port: number): Promise<PortInfo>;
    removePort(_port: number): Promise<void>;
    createSandbox(_options: CreateSandboxOptions): Promise<SandboxInfo>;
    deleteSandbox(_id: string): Promise<void>;
    listSandboxes(): Promise<SandboxInfo[]>;
    getCreditsBalance(): Promise<number>;
    getCreditsPricing(): Promise<PricingTier[]>;
    transferCredits(toAddress: string, amountCents: number, note?: string): Promise<CreditTransferResult>;
    searchDomains(_query: string, _tlds?: string): Promise<DomainSearchResult[]>;
    registerDomain(domain: string, _years?: number): Promise<DomainRegistration>;
    listDnsRecords(_domain: string): Promise<DnsRecord[]>;
    addDnsRecord(_domain: string, type: string, host: string, value: string, ttl?: number): Promise<DnsRecord>;
    deleteDnsRecord(_domain: string, _recordId: string): Promise<void>;
    listModels(): Promise<ModelInfo[]>;
}
export declare class MockSocialClient implements SocialClientInterface {
    sentMessages: {
        to: string;
        content: string;
        replyTo?: string;
    }[];
    pollResponses: {
        messages: InboxMessage[];
        nextCursor?: string;
    }[];
    private pollIndex;
    unread: number;
    send(to: string, content: string, replyTo?: string): Promise<{
        id: string;
    }>;
    poll(cursor?: string, limit?: number): Promise<{
        messages: InboxMessage[];
        nextCursor?: string;
    }>;
    unreadCount(): Promise<number>;
}
export declare function createTestDb(): AutomatonDatabase;
export declare function createTestIdentity(): AutomatonIdentity;
export declare function createTestConfig(overrides?: Partial<AutomatonConfig>): AutomatonConfig;
//# sourceMappingURL=mocks.d.ts.map