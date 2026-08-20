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
