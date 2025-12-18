export const successResponse = (data: any, message: string = "Success") => {
  return {
    success: true,
    message,
    data,
  };
};

export const errorResponse = (
  message: string = "Error",
  statusCode: number = 500,
) => {
  return {
    success: false,
    message,
    statusCode,
  };
};

export const paginationResponse = (
  data: any[],
  page: number,
  limit: number,
  total: number,
) => {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


