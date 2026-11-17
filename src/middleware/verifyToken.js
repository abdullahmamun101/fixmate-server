
import { createRemoteJWKSet, jwtVerify } from "jose";

let JWKS;

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const authURL = process.env.BETTER_AUTH_URL;

    if (!JWKS) {
      JWKS = createRemoteJWKSet(
        new URL(`${authURL}/api/auth/jwks`)
      );
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authURL,
      audience: authURL,
    });

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default verifyToken;
