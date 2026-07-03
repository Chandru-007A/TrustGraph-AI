import express from 'express';
import * as userController from '../../controllers/user.controller';
import validate from '../../middlewares/validate.middleware';
import * as userValidation from '../../validations/user.validation';

const router = express.Router();

router
  .route('/')
  .post(validate(userValidation.createUserSchema), userController.createUser)
  .get(userController.getUsers);

router
  .route('/:id')
  .get(validate(userValidation.getUserSchema), userController.getUser)
  .put(validate(userValidation.updateUserSchema), userController.updateUser)
  .delete(validate(userValidation.deleteUserSchema), userController.deleteUser);

export default router;
