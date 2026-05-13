import { factories } from "@strapi/strapi";
import { generateSubTodosWithAI } from "../../sub-todo/services/ai-generator";

const toNumber = (value: unknown) => parseInt(String(value), 10);

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }) => ({
    async create(ctx) {
      const userId = ctx.state.user?.id;

      if (!userId) {
        return ctx.unauthorized("You must be logged in");
      }

      const { title } = ctx.request.body.data;

      console.log("[Todo Create] Creating todo with title:", title);

      // CREATE MAIN TODO
      const todo = await strapi.entityService.create("api::todo.todo", {
        data: {
          title,
          isCompleted: false,
          users_permissions_user: userId,
        },
      });

      console.log("[Todo Create] Todo created with ID:", todo.id);

      // GENERATE AI SUBTODOS
      console.log("[Todo Create] Starting AI generation...");

      const generatedSubTodos = await generateSubTodosWithAI(title);

      console.log("[Todo Create] AI generated subtodos:", generatedSubTodos);

      // INSERT SUBTODOS INTO DB
      const createdSubTodos = [];

      for (const subTitle of generatedSubTodos) {
        const createdSubTodo = await strapi.entityService.create(
          "api::sub-todo.sub-todo",
          {
            data: {
              title: subTitle,
              isCompleted: false,
              todo: todo.id,
            },
          },
        );

        createdSubTodos.push(createdSubTodo);
      }

      console.log("[Todo Create] Created", createdSubTodos.length, "SubTodos");

      // RETURN EVERYTHING
      return {
        data: {
          ...todo,
          subTodos: createdSubTodos,
        },
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

      if (
        !todo ||
        toNumber((todo as any).users_permissions_user?.id) !== toNumber(userId)
      ) {
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

      if (
        !todo ||
        toNumber((todo as any).users_permissions_user?.id) !== toNumber(userId)
      ) {
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
        populate: ["users_permissions_user", "subTodos"],
      });

      return {
        data: todos,
      };
    },
  }),
);
