const UNKNOWN_SENDER = 'Unknown sender';

export function formatSenderName(value?: string): string {
    const sender = value?.trim();
    if (!sender) {
        return UNKNOWN_SENDER;
    }

    const addressStart = sender.lastIndexOf('<');
    const addressEnd = sender.indexOf('>', addressStart + 1);
    if (addressStart !== -1 && addressEnd !== -1) {
        const displayName = sender.slice(0, addressStart).trim();
        return displayName
            ? unquote(displayName)
            : addressName(sender.slice(addressStart + 1, addressEnd));
    }

    return sender.includes('@') ? addressName(sender) : unquote(sender);
}

export function extractSenderEmail(value?: string): string | undefined {
    const sender = value?.trim();
    if (!sender) {
        return undefined;
    }

    const addressStart = sender.lastIndexOf('<');
    const addressEnd = sender.indexOf('>', addressStart + 1);
    const address = addressStart !== -1 && addressEnd !== -1
        ? sender.slice(addressStart + 1, addressEnd).trim()
        : sender;

    return /^[^\s@]+@[^\s@]+$/.test(address) ? address.toLowerCase() : undefined;
}

export function senderInitials(value?: string): string {
    const name = formatSenderName(value);
    if (name === UNKNOWN_SENDER) {
        return '?';
    }

    const words = name.split(/[\s,]+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].slice(0, 1).toUpperCase();
    }

    return `${words[0][0]}${words.at(-1)![0]}`.toUpperCase();
}

function addressName(address: string): string {
    return address.trim().split('@', 1)[0] || UNKNOWN_SENDER;
}

function unquote(name: string): string {
    if (name.startsWith('"') && name.endsWith('"')) {
        return name.slice(1, -1).replace(/\\(["\\])/g, '$1').trim() || UNKNOWN_SENDER;
    }

    return name;
}
