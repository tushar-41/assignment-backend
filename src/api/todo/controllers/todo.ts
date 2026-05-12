import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }) => ({
    async create(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      const { title, isCompleted } = ctx.request.body.data;

      const todo = await strapi.entityService.create("api::todo.todo", {
        data: {
          title,
          isCompleted: isCompleted || false,
          users_permissions_user: userId,
        },
      });

      return {
        data: todo,
      };
    },

    async update(ctx) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      const todo = await strapi.entityService.findOne("api::todo.todo", id, {
        populate: "*",
      });

      if (!todo || (todo as any).users_permissions_user?.id !== userId) {
        return ctx.notFound("Todo not found");
      }

      const updatedTodo = await strapi.entityService.update(
        "api::todo.todo",
        id,
        {
          data: ctx.request.body.data,
        },
      );

      return {
        data: updatedTodo,
      };
    },

    async delete(ctx) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      const todo = await strapi.entityService.findOne("api::todo.todo", id, {
        populate: ["users_permissions_user"],
      });

      if (!todo || (todo as any).users_permissions_user?.id !== userId) {
        return ctx.notFound("Todo not found");
      }

      await strapi.entityService.delete("api::todo.todo", id);

      return {
        message: "Todo deleted successfully",
      };
    },

    async find(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      const todos = await strapi.entityService.findMany("api::todo.todo", {
        filters: {
          users_permissions_user: {
            id: {
              $eq: userId,
            },
          },
        },
        sort: { createdAt: "desc" },
        populate: ["users_permissions_user"],
      });

      return {
        data: todos,
      };
    },
  }),
);
