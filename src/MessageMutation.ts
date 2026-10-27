export type MessageMutation =
    | {kind: 'labels'; addLabelIds?: string[]; removeLabelIds?: string[]}
    | {kind: 'trash'}
    | {kind: 'restore'}
    | {kind: 'delete'};

export function applyLabelMutation(labelIds: string[], mutation: MessageMutation): string[] {
    const labels = new Set(labelIds);
    if (mutation.kind === 'labels') {
        mutation.removeLabelIds?.forEach((label) => labels.delete(label));
        mutation.addLabelIds?.forEach((label) => labels.add(label));
    } else if (mutation.kind === 'trash') {
        labels.add('TRASH');
    } else if (mutation.kind === 'restore') {
        labels.delete('TRASH');
    }
    return [...labels];
}
