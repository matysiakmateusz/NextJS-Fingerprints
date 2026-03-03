export interface Account {
  userId: string;
  name: string;
  email: string;
  visitorId: string;
  createdAt: string;
}

const globalAccounts = globalThis as unknown as {
  __accounts: Account[];
};

if (!globalAccounts.__accounts) {
  globalAccounts.__accounts = [];
}

export function addAccount(account: Account): void {
  globalAccounts.__accounts.push(account);
}

export function getAccounts(): Account[] {
  return [...globalAccounts.__accounts];
}
