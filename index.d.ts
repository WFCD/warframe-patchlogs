declare module 'warframe-patchlogs' {
    class Patchlogs {
        constructor();
        posts: Array<PatchData>;
        getItemChanges(item: PatchOptions): Array<PatchData>;
    }
    interface PatchData {
        name: string;
        date: string;
        imgUrl: string;
        url: string;
        additions: string;
        fixes: string;
        changes: string;
    }
    interface PatchOptions {
        abilities: Array<Ability>;
        name: string;
        type: string;
    }
    interface Ability {
        name: string;
    }
    export const patchlogs: Patchlogs;
}
