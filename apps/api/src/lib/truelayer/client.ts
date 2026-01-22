const TRUELAYER_AUTH_URL = "https://auth.truelayer-sandbox.com";
const TRUELAYER_DATA_URL = "https://api.truelayer-sandbox.com/data/v1";

export async function getExchangeToken(code: string) {
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("client_id", process.env.TRUELAYER_CLIENT_ID || "");
  params.append("client_secret", process.env.TRUELAYER_CLIENT_SECRET || "");
  params.append("redirect_uri", process.env.TRUELAYER_REDIRECT_URI || "");
  params.append("code", code);

  const response = await fetch(`${TRUELAYER_AUTH_URL}/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("TrueLayer Token Error Details:", errorText);
    throw new Error(`Failed to exchange TrueLayer code: ${errorText}`);
  }

  return response.json();
}

export async function getAccounts(accessToken: string) {
  const response = await fetch(`${TRUELAYER_DATA_URL}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch TrueLayer accounts");
  }

  return response.json();
}

export async function getTransactions(accessToken: string, accountId: string) {
  const response = await fetch(
    `${TRUELAYER_DATA_URL}/accounts/${accountId}/transactions`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch TrueLayer transactions");
  }

  return response.json();
}

export async function getAccountBalance(accessToken: string, accountId: string) {
  const response = await fetch(
    `${TRUELAYER_DATA_URL}/accounts/${accountId}/balance`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch TrueLayer account balance");
  }

  return response.json();
}

