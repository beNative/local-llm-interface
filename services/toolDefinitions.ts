import type { Tool, ChatSession } from '../types';

/**
 * Returns the set of tools available for the given session context.
 * Centralises all tool schema definitions so they can be maintained
 * independently of the conversation loop.
 */
export function getToolsForSession(
    session: ChatSession,
    project: { path: string } | null | undefined,
    isElectron: boolean
): Tool[] {
    const tools: Tool[] = [];

    if (!isElectron) return tools;

    // Agent tools require both a project and the per-session toggle
    if (project && session.agentToolsEnabled) {
        tools.push(
            {
                type: 'function',
                function: {
                    name: 'executePython',
                    description:
                        'Executes a Python code snippet and returns its standard output and standard error. ' +
                        'Use this for complex calculations, data processing, or when you need to verify logic with code.',
                    parameters: {
                        type: 'object',
                        properties: {
                            code: {
                                type: 'string',
                                description: 'The Python code to execute.',
                            },
                        },
                        required: ['code'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'listFiles',
                    description:
                        'Recursively lists all files and directories within the project, returning an array of relative paths.',
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'readFile',
                    description: "Reads a file's content.",
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'The relative path to the file from the project root.',
                            },
                        },
                        required: ['path'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'writeFile',
                    description:
                        "Writes content to a file, overwriting it if it exists or creating it if it doesn't.",
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'The relative path to the file from the project root.',
                            },
                            content: {
                                type: 'string',
                                description: 'The new file content.',
                            },
                        },
                        required: ['path', 'content'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'runTerminalCommand',
                    description: "Executes a shell command in the project's root directory.",
                    parameters: {
                        type: 'object',
                        properties: {
                            command: {
                                type: 'string',
                                description: 'The command to execute.',
                            },
                        },
                        required: ['command'],
                    },
                },
            }
        );
    }

    return tools;
}
