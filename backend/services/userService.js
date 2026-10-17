const UserModel = require('../models/userModel');

class UserService {
  static async getAllUsers() {
    return await UserModel.findAll();
  }

  static async getUserById(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    return user;
  }
}

module.exports = UserService;
