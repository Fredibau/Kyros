import type { FastifyInstance } from "fastify";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "../lib/prisma.js";

const rpID = process.env.RP_ID ?? "localhost";
const origin = process.env.RP_ORIGIN ?? "http://localhost:3000";
const rpName = process.env.RP_NAME ?? "Kairos Tax Vault";

type RegistrationPayload = {
  email?: string;
};

type VerifyRegistrationPayload = {
  email?: string;
  body?: any;
  currentChallenge?: string;
};

type AuthenticationPayload = {
  userId?: string;
  email?: string;
};

type VerifyAuthenticationPayload = {
  userId?: string;
  body?: any;
  currentChallenge?: string;
};

export async function passkeyRoutes(app: FastifyInstance) {
  app.post("/auth/passkey/generate-registration", async (request, reply) => {
    const { email } = request.body as RegistrationPayload;

    if (!email) {
      return reply.code(400).send({ error: "Email is required" });
    }

    let user = await prisma.user.findUnique({
      where: { email },
      include: { passkeys: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email },
        include: { passkeys: true },
      });
    }
    if (user.passkeys.length > 0) {
      return reply
        .code(409)
        .send({ error: "Passkey already exists for this user" });
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id),
      userName: email,
      attestationType: "none",
      excludeCredentials: user.passkeys.map((passkey) => ({
        id: passkey.credentialID,
        type: "public-key",
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    return reply.send(options);
  });

  app.post("/auth/passkey/verify-registration", async (request, reply) => {
    const { email, body, currentChallenge } =
      request.body as VerifyRegistrationPayload;

    if (!email || !body || !currentChallenge) {
      return reply.code(400).send({ error: "Missing required data" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    const existingPasskey = await prisma.passkey.findFirst({
      where: { userId: user.id },
    });
    if (existingPasskey) {
      return reply
        .code(409)
        .send({ error: "Passkey already exists for this user" });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const regInfo = verification.registrationInfo as any;
      const credentialID =
        regInfo.credential?.id || regInfo.credentialID || regInfo.credentialId;
      const credentialPublicKey =
        regInfo.credential?.publicKey || regInfo.credentialPublicKey;
      const counter = regInfo.credential?.counter ?? regInfo.counter ?? 0;

      if (!credentialID || !credentialPublicKey) {
        app.log.error(
          "Missing credential data in registrationInfo",
          regInfo,
        );
        throw new Error("Credential data missing from verification response");
      }

      await prisma.passkey.create({
        data: {
          userId: user.id,
          credentialID:
            typeof credentialID === "string"
              ? credentialID
              : Buffer.from(credentialID).toString("base64"),
          publicKey: Buffer.from(credentialPublicKey),
          counter: BigInt(counter),
          deviceType: regInfo.credentialDeviceType || "unknown",
          backedUp: regInfo.credentialBackedUp || false,
        },
      });

      const existingWallet = await prisma.wallet.findFirst({
        where: { userId: user.id, provider: "seedless-passkey" },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        userId: user.id,
        walletAddress: existingWallet?.address || null,
        email: user.email,
      });
    }

    return reply.code(400).send({ error: "Verification failed" });
  });

  app.post("/auth/passkey/generate-authentication", async (request, reply) => {
    const { userId, email } = request.body as AuthenticationPayload;

    if (!userId && !email) {
      return reply.code(400).send({ error: "User ID or email is required" });
    }

    const user = await prisma.user.findUnique({
      where: userId ? { id: userId } : { email },
      include: { passkeys: true },
    });

    if (!user || user.passkeys.length === 0) {
      return reply.code(404).send({ error: "No passkeys found for user" });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.passkeys.map((passkey) => ({
        id: passkey.credentialID,
        type: "public-key",
        transports: passkey.transports
          ? JSON.parse(passkey.transports)
          : undefined,
      })),
      userVerification: "preferred",
    });

    return reply.send({
      ...options,
      userId: user.id,
      email: user.email,
    });
  });

  app.post("/auth/passkey/verify-authentication", async (request, reply) => {
    const { userId, body, currentChallenge } =
      request.body as VerifyAuthenticationPayload;

    if (!userId || !body || !currentChallenge) {
      return reply.code(400).send({ error: "Missing required data" });
    }

    const passkey = await prisma.passkey.findFirst({
      where: {
        userId,
        credentialID: body.id,
      },
    });

    if (!passkey) {
      return reply.code(404).send({ error: "Passkey not found" });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialID,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
      },
    });

    if (verification.verified) {
      await prisma.passkey.update({
        where: { id: passkey.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const existingWallet = await prisma.wallet.findFirst({
        where: { userId, provider: "seedless-passkey" },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        userId,
        email: user?.email ?? null,
        walletAddress: existingWallet?.address || null,
      });
    }

    return reply.code(400).send({ error: "Verification failed" });
  });
}

