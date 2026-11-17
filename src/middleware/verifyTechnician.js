import verifyToken from "./verifyToken.js";

const verifyTechnician = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "technician") {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  });
};

export default verifyTechnician;