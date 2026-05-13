import { factories } from "@strapi/strapi";

const toNumber = (value: unknown) => parseInt(String(value), 10);

export default factories.createCoreController(
  "api::sub-todo.sub-todo",
  ({ strapi }) => ({
    async create(ctx) {
      const userId = ctx.state.user?.id;

      console.log("[SubTodo Create] userId:", userId, "type:", typeof userId);
      console.log("[SubTodo Create] Request body:", ctx.request.body);

      if (!userId) {
        console.log("[SubTodo Create] No userId found");
        return ctx.unauthorized("You must be logged in");
      }

      const { todoId } = ctx.request.body.data;

      console.log(
        "[SubTodo Create] todoId from request:",
        todoId,
        "type:",
        typeof todoId,
      );

      if (!todoId) {
        return ctx.badRequest("todoId is required");
      }

      // Verify that the Todo belongs to the logged-in user
      const todo = await strapi.entityService.findOne(
        "api::todo.todo",
        todoId,
        {
          populate: ["users_permissions_user"],
        },
      );

      console.log("[SubTodo Create] Todo found:", !!todo);
      if (todo) {
        console.log(
          "[SubTodo Create] Todo details:",
          JSON.stringify(todo, null, 2),
        );
        console.log(
          "[SubTodo Create] Todo owner ID:",
          (todo as any).users_permissions_user?.id,
          "type:",
          typeof (todo as any).users_permissions_user?.id,
        );
      }
      console.log(
        "[SubTodo Create] Comparing:",
        toNumber((todo as any).users_permissions_user?.id),
        "===",
        toNumber(userId),
      );

      if (!todo) {
        console.log("[SubTodo Create] Todo not found");
        return ctx.notFound("Todo not found");
      }

      const todoOwnerId = (todo as any).users_permissions_user?.id;
      if (
        todoOwnerId !== userId &&
        toNumber(todoOwnerId) !== toNumber(userId)
      ) {
        console.log(
          "[SubTodo Create] Forbidden: User is not the owner of the todo",
        );
        return ctx.forbidden("You can only add SubTodos to your own Todos");
      }

      const subTodo = await strapi.entityService.create(
        "api::sub-todo.sub-todo",
        {
          data: {
            title: ctx.request.body.data.title,
            isCompleted: ctx.request.body.data.isCompleted || false,
            todo: todoId,
          },
        },
      );

      console.log("[SubTodo Create] SubTodo created:", subTodo.id);

      return {
        data: subTodo,
      };
    },

    async update(ctx) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;

      console.log("[SubTodo Update] userId:", userId, "subTodoId:", id);

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      // FETCH SUBTODO
      const subTodo = await strapi.entityService.findOne(
        "api::sub-todo.sub-todo",
        id,
        {
          populate: "*",
        },
      );

      console.log("[SubTodo Update] Found subTodo:", subTodo);

      if (!subTodo) {
        return ctx.notFound("SubTodo not found");
      }

      // HANDLE BOTH RELATION SHAPES
      const todoId =
        typeof (subTodo as any).todo === "object"
          ? (subTodo as any).todo?.id
          : (subTodo as any).todo;

      console.log("[SubTodo Update] Extracted todoId:", todoId);

      if (!todoId) {
        return ctx.badRequest("Todo relation missing");
      }

      // FETCH PARENT TODO
      const todo = await strapi.entityService.findOne(
        "api::todo.todo",
        todoId,
        {
          populate: ["users_permissions_user"],
        },
      );

      console.log("[SubTodo Update] Parent todo:", todo);

      if (!todo) {
        return ctx.notFound("Parent Todo not found");
      }

      const todoOwnerId = (todo as any).users_permissions_user?.id;

      console.log("[SubTodo Update] Todo owner:", todoOwnerId);

      // OWNERSHIP CHECK
      if (toNumber(todoOwnerId) !== toNumber(userId)) {
        return ctx.forbidden("You can only update SubTodos of your own Todos");
      }

      // UPDATE SUBTODO
      const updatedSubTodo = await strapi.entityService.update(
        "api::sub-todo.sub-todo",
        id,
        {
          data: ctx.request.body.data,
        },
      );

      console.log("[SubTodo Update] Updated successfully:", updatedSubTodo);

      return {
        data: updatedSubTodo,
      };
    },
    async delete(ctx) {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      // Fetch the SubTodo with its parent Todo
      const subTodo = await strapi.entityService.findOne(
        "api::sub-todo.sub-todo",
        id,
        {
          populate: ["todo"],
        },
      );

      if (!subTodo) {
        return ctx.notFound("SubTodo not found");
      }

      // Verify ownership through the parent Todo
      const todo = await strapi.entityService.findOne(
        "api::todo.todo",
        (subTodo as any).todo?.id,
        {
          populate: ["users_permissions_user"],
        },
      );

      if (
        !todo ||
        toNumber((todo as any).users_permissions_user?.id) !== toNumber(userId)
      ) {
        return ctx.forbidden("You can only delete SubTodos of your own Todos");
      }

      await strapi.entityService.delete("api::sub-todo.sub-todo", id);

      return {
        message: "SubTodo deleted successfully",
      };
    },

    async find(ctx) {
      const userId = ctx.state.user?.id;
      const { todoId } = ctx.query as { todoId: string };

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      if (!todoId) {
        return ctx.badRequest("todoId query parameter is required");
      }

      // Verify that the Todo belongs to the logged-in user
      const todo = await strapi.entityService.findOne(
        "api::todo.todo",
        todoId,
        {
          populate: ["users_permissions_user"],
        },
      );

      if (
        !todo ||
        toNumber((todo as any).users_permissions_user?.id) !== toNumber(userId)
      ) {
        return ctx.forbidden("You can only view SubTodos of your own Todos");
      }

      const subTodos = await strapi.entityService.findMany(
        "api::sub-todo.sub-todo",
        {
          filters: {
            todo: {
              id: {
                $eq: todoId,
              },
            },
          },
          sort: { createdAt: "desc" },
          populate: ["todo"],
        },
      );

      return {
        data: subTodos,
      };
    },
  }),
);
