<script lang="ts">
    import {getContext} from "svelte";
    import {Context} from "../Context";
    import type {SenderAvatarService} from "../services/SenderAvatarService";
    import {extractSenderEmail, senderInitials} from "../SenderFormatter";

    let {
        sender,
        size = 28,
    }: {
        sender?: string,
        size?: number,
    } = $props();

    const avatarService: SenderAvatarService = getContext(Context.SENDER_AVATAR_SERVICE);

    let imageUrl: string | undefined = $state();
    let gravatarUrl: string | undefined = $state();
    let imageSource: 'contact' | 'gravatar' | 'initials' = $state('initials');
    let initials = $derived(senderInitials(sender));
    let avatarColor = $derived(colorForSender(sender));

    $effect(() => {
        const currentSender = sender;
        const currentSize = size;
        let cancelled = false;

        imageUrl = undefined;
        gravatarUrl = undefined;
        imageSource = 'initials';

        void Promise.all([
            avatarService.getContactPhoto(currentSender),
            getGravatarUrl(currentSender, currentSize).catch(() => undefined),
        ]).then(([contactPhoto, resolvedGravatarUrl]) => {
            if (cancelled || sender !== currentSender) {
                return;
            }

            gravatarUrl = resolvedGravatarUrl;
            if (contactPhoto) {
                imageUrl = contactPhoto;
                imageSource = 'contact';
            } else if (resolvedGravatarUrl) {
                imageUrl = resolvedGravatarUrl;
                imageSource = 'gravatar';
            }
        });

        return () => {
            cancelled = true;
        };
    });

    const handleImageError = () => {
        if (imageSource === 'contact' && gravatarUrl) {
            imageUrl = gravatarUrl;
            imageSource = 'gravatar';
            return;
        }

        imageUrl = undefined;
        imageSource = 'initials';
    };

    async function getGravatarUrl(value: string | undefined, imageSize: number): Promise<string | undefined> {
        const email = extractSenderEmail(value);
        if (!email || !globalThis.crypto?.subtle) {
            return undefined;
        }

        const bytes = new TextEncoder().encode(email);
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        const hash = [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');

        return `https://gravatar.com/avatar/${hash}?s=${imageSize * 2}&d=404`;
    }

    function colorForSender(value?: string): string {
        let hash = 0;
        for (const character of value ?? '') {
            hash = (hash * 31 + character.charCodeAt(0)) | 0;
        }

        return `hsl(${Math.abs(hash) % 360} 45% 42%)`;
    }
</script>

<span
    class="sender-avatar"
    style:width={`${size}px`}
    style:height={`${size}px`}
    style:background-color={avatarColor}
    aria-hidden="true"
>
    {#if imageUrl}
        <img src={imageUrl} alt="" onerror={handleImageError}/>
    {:else}
        <span>{initials}</span>
    {/if}
</span>

<style>
    .sender-avatar {
        align-items: center;
        border-radius: 50%;
        display: inline-flex;
        flex: 0 0 auto;
        justify-content: center;
        overflow: hidden;
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
    }

    img {
        height: 100%;
        object-fit: cover;
        width: 100%;
    }
</style>
