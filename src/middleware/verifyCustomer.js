import verifyToken from "./verifyToken.js";

const verifyCustomer = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  });
};

export default verifyCustomer;