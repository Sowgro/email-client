import {extractSenderEmail} from "../SenderFormatter";

interface PeopleConnectionsResponse {
    connections?: Array<{
        emailAddresses?: Array<{value?: string}>;
        photos?: Array<{url?: string, default?: boolean}>;
    }>;
    nextPageToken?: string;
}

export class SenderAvatarService {
    private account: string | undefined;
    private contactPhotos: Promise<ReadonlyMap<string, string>> | undefined;

    public setAccount(account: string | undefined) {
        if (account === this.account) {
            return;
        }

        this.account = account;
        this.contactPhotos = undefined;
    }

    public async getContactPhoto(sender?: string): Promise<string | undefined> {
        const email = extractSenderEmail(sender);
        if (!email) {
            return undefined;
        }

        this.contactPhotos ??= this.loadContactPhotos().catch(() => new Map());
        return (await this.contactPhotos).get(email);
    }

    private async loadContactPhotos(): Promise<ReadonlyMap<string, string>> {
        const accessToken = gapi.client.getToken()?.access_token;
        if (!accessToken) {
            return new Map();
        }

        const photos = new Map<string, string>();
        let pageToken: string | undefined;

        do {
            const url = new URL('https://people.googleapis.com/v1/people/me/connections');
            url.searchParams.set('personFields', 'emailAddresses,photos');
            url.searchParams.set('pageSize', '1000');
            if (pageToken) {
                url.searchParams.set('pageToken', pageToken);
            }

            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${accessToken}`},
            });
            if (!response.ok) {
                throw new Error(`Could not load Google contact photos (${response.status}).`);
            }

            const page = await response.json() as PeopleConnectionsResponse;
            for (const person of page.connections ?? []) {
                const photo = person.photos?.find((candidate) => candidate.url && !candidate.default)?.url;
                if (!photo) {
                    continue;
                }

                for (const emailAddress of person.emailAddresses ?? []) {
                    const email = emailAddress.value?.trim().toLowerCase();
                    if (email) {
                        photos.set(email, photo);
                    }
                }
            }
            pageToken = page.nextPageToken;
        } while (pageToken);

        return photos;
    }
}
