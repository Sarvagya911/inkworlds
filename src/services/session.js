// The signed-in user.
export const session = { user: null, profile: null };

export const myId = () => session.user?.id || null;
