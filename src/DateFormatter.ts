const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
});

const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
});

const monthYearFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
});

const detailedDateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'always',
});

const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function formatListDate(value?: string, now = new Date()): string {
    if (!value) {
        return '??';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date >= today && date < tomorrow) {
        return timeFormatter.format(date);
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date >= yesterday && date < today) {
        return 'Yesterday';
    }

    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    if (date >= lastWeek && date < yesterday) {
        return weekdayFormatter.format(date);
    }

    if (date.getFullYear() === now.getFullYear()) {
        return monthDayFormatter.format(date);
    }

    return monthYearFormatter.format(date);
}

export function formatEmailViewDate(value?: string, now = new Date()): string {
    if (!value) {
        return '??';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const absoluteDate = date >= today && date < tomorrow
        ? timeFormatter.format(date)
        : detailedDateFormatter.format(date);

    return `${absoluteDate} (${formatRelativeTime(date, now)})`;
}

function formatRelativeTime(date: Date, now: Date): string {
    const differenceMs = date.getTime() - now.getTime();
    const absoluteDifferenceMs = Math.abs(differenceMs);

    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const monthMs = 30 * dayMs;
    const yearMs = 365 * dayMs;

    if (absoluteDifferenceMs < minuteMs) {
        return 'just now';
    }

    if (absoluteDifferenceMs < hourMs) {
        return relativeTimeFormatter.format(Math.round(differenceMs / minuteMs), 'minute');
    }

    if (absoluteDifferenceMs < dayMs) {
        return relativeTimeFormatter.format(Math.round(differenceMs / hourMs), 'hour');
    }

    if (absoluteDifferenceMs < monthMs) {
        return relativeTimeFormatter.format(Math.round(differenceMs / dayMs), 'day');
    }

    if (absoluteDifferenceMs < yearMs) {
        return relativeTimeFormatter.format(Math.round(differenceMs / monthMs), 'month');
    }

    return relativeTimeFormatter.format(Math.round(differenceMs / yearMs), 'year');
}
