import { randomBytes } from "crypto";
import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { findUserByEmail, createUser, resolveUserRole } from "../services/user.service";
import { setAuthCookie, signToken } from "../utils/jwt";

function getGoogleClient(redirectUri?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for Google OAuth",
    );
  }

  const defaultRedirectUri = process.env.GOOGLE_CALLBACK_URL || "postmessage";
  return new OAuth2Client(clientId, clientSecret, redirectUri ?? defaultRedirectUri);
}

async function verifyGooglePayload(payload: string | undefined) {
  if (!payload) {
    throw new Error("Google response did not include a payload");
  }

  const oauthClient = getGoogleClient();
  const ticket = await oauthClient.verifyIdToken({
    idToken: payload,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
}

export async function googleAuth(req: Request, res: Response) {
  try {
    const { credential, code } = req.body as { credential?: string; code?: string };

    if (!credential && !code) {
      return res.status(400).json({ message: "Missing Google credential or authorization code" });
    }

    let payload: any;

    if (code) {
      const oauthClient = getGoogleClient("postmessage");
      const { tokens } = await oauthClient.getToken(code);
      const idToken = tokens.id_token;
      if (!idToken) {
        throw new Error("Google did not return an id_token");
      }
      const verified = await oauthClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = verified.getPayload();
    } else {
      payload = await verifyGooglePayload(credential);
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Invalid Google token: no email found" });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleName = payload.name || payload.email?.split("@")[0] || "Google User";

    let user = await findUserByEmail(googleEmail);

    if (user) {
      const role = resolveUserRole(googleEmail, user.role);
      if (role !== user.role) {
        const { updateUserRole } = await import("../services/user.service");
        await updateUserRole(user.id, role);
        user.role = role;
      }
    } else {
      const randomPassword = randomBytes(32).toString("hex");
      user = await createUser({
        name: googleName,
        email: googleEmail,
        password: randomPassword,
        role: resolveUserRole(googleEmail),
      });
    }

    const token = signToken({ sub: user.id, role: user.role });
    setAuthCookie(res, token);

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Google auth failed:", error);
    if (
      error.message?.includes("Invalid token") ||
      error.message?.includes("Token used too late") ||
      error.message?.includes("invalid_grant")
    ) {
      return res
        .status(401)
        .json({ message: "Google token is invalid or expired. Please try again." });
    }
    return res
      .status(500)
      .json({ message: "Unable to authenticate with Google. Please try again." });
  }
}
