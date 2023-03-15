export const delay = async (time: number) => new Promise<void>((resolve: () => void) => setTimeout(resolve, time));
