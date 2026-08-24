interface SubjectMessage {
    subject?: string;
    internalDate?: string;
    date?: string;
}

export function formatConversationSubject(
    messages: SubjectMessage[],
    fallback?: string,
): string {
    const firstSubject = [...messages]
        .sort((left, right) => getTimestamp(left) - getTimestamp(right))
        .find(({subject}) => subject?.trim())
        ?.subject ?? fallback;
    const firstLine = firstSubject?.split(/\r?\n/, 1)[0].trim() ?? '';

    return firstLine.replace(/^(?:\s*re(?:\[\d+])?\s*:\s*)+/i, '').trim() || 'No subject';
}

function getTimestamp(message: SubjectMessage): number {
    const internalTimestamp = Number(message.internalDate);
    if (Number.isFinite(internalTimestamp) && internalTimestamp > 0) {
        return internalTimestamp;
    }

    const headerTimestamp = Date.parse(message.date ?? '');
    return Number.isNaN(headerTimestamp) ? Number.POSITIVE_INFINITY : headerTimestamp;
}
