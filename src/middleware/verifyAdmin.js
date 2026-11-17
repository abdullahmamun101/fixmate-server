import verifyToken from "./verifyToken.js";

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  });
};

export default verifyAdmin;