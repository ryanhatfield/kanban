function Task (task)
{
	this.record = task;

	this.add();
}



Task.prototype.board = function()
{
	return boards[this.record.board_id];
};



Task.prototype.add = function()
{
	this.record.status = this.board().record.status_records()[this.record.status_id] ? this.board().record.status_records()[this.record.status_id] : {};
	this.record.project = this.board().record.project_records[this.record.project_id] ? this.board().record.project_records[this.record.project_id] : {};
	this.record.estimate = this.board().record.estimate_records()[this.record.estimate_id] ? this.board().record.estimate_records()[this.record.estimate_id] : {};
	this.record.user_assigned = this.board().record.allowed_users()[this.record.user_id_assigned] ? this.board().record.allowed_users()[this.record.user_id_assigned] : {};
	this.record.hour_count_formatted = format_hours(this.record.hour_count);

	var task_html = templates['t-task'].render({
		task: this.record,
		estimate_records: this.board().record.estimate_records(),
		project_records: this.board().record.project_records,
		allowed_users:  this.board().record.allowed_users()
	});

	var $col = $('#status-{0}-tasks'.sprintf(this.record.status_id) );

	this.$el = $(task_html).prependTo($col);

	encode_urls_emails ( $('.task-title', this.$el) );

	this.dom();

	this.update_board();

	$(document).trigger('/task/added/', this.record);
}; // add




Task.prototype.dom = function()
{
	var self = this;

	self.update_progress();

	self.$el.on(
		'click',
		'.btn-task-delete',
		function ()
		{
			var $btn = $(this);
			$('.glyphicon', $btn).show();

			self.delete();

			return false;
		}
	);



	self.$el
	.on(
		'shown.bs.dropdown',
		'.dropdown',
		function ()
		{
			var $dropdown = $(this);
			$('.task.active', self.board().$el).not(self.$el).removeClass('active');
			self.$el.addClass('active');
		}
	)
	.on(
		'hidden.bs.dropdown',
		function ()
		{
			self.$el.removeClass('active');
		}
	);



	self.$el
	.on(
		'show.bs.dropdown',
		'.task-project',
		function ()
		{
			var $project = $(this);
			var $dropdown = $('.dropdown-menu', $project).empty();

			for ( var project_id in self.board().record.project_records )
			{
				var project = self.board().record.project_records[project_id];

				var project_html = templates['t-task-project-dropdown'].render(project);

				$(project_html).prependTo($dropdown);
			}
		}
	)
	.on(
		'hide.bs.dropdown',
		'.task-project',
		function ()
		{
			var $project = $(this);
			var $contenteditable = $('[contenteditable]', $project);
			if ( $contenteditable.is(':focus') )
			{
				return false;
			}

		}
	)
	.on(
		'keydown',
		'.task-project [contenteditable]',
		function (e)
		{
			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var $div = $(this);
			var $dropdown = $div.closest('.dropdown');

			// escape
			if(e.keyCode === 27)
			{
				// get prev value
				var orig = $div.data('orig');

				// restore prev value
				$div.html(orig);

				// trigger save
				$div.blur();

				// prevent save
				clearTimeout($div.data('save_timer'));

				if ( $dropdown.hasClass('open') )
				{
					$dropdown.removeClass('open')
				}

				return;
			}

			// enter
			if (e.keyCode === 13)
			{
				$div.blur();

				if ( $dropdown.hasClass('open') )
				{
					$dropdown.removeClass('open')
				}

				return;
			}

		}
	)	
	.on(
		'blur',
		'.task-project [contenteditable]',
		function()
		{
			window.getSelection().removeAllRanges();

			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var save_timer = setTimeout (function()
			{
				self.parse_project();
			}, 100);

			$(this).data('save_timer', save_timer);
		}
	)
	.on(
		'focus',
		'.task-project [contenteditable]',
		function()
		{
			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var $div = $(this);

			$div.data('orig', $div.text());
		}
	); // task-project;






	self.$el.on(
		'click',
		'.btn-project-assign',
		function ()
		{
			var $btn = $(this);
			var $dropdown = $btn.closest('.dropdown');
			var $contenteditable = $('[contenteditable]', $dropdown);

			//prevent save on blur
			clearTimeout($contenteditable.data('save_timer'));

			var project_id = $btn.attr('data-id');
			self.project_save(project_id);
		}
	);





	self.$el
	.on(
		'focus',
		'.task-title',
		function(e)
		{
			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var $div = $(this);

			if ( $(e.target).is('a') )
			{
				return false;
			}

			$div.data('orig', $div.html());

			$div.html( sanitize_string($div.html()) );
		}
	)
	.on(
		'keydown',
		'.task-title',
		function(e)
		{
			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var $div = $(this);

			// escape
			if(e.keyCode === 27)
			{
				// get prev value
				var orig = $div.data('orig');

				// restore prev value
				$div.html(orig);

				// trigger save
				$div.blur();

				return;
			}

			// enter
			if (e.keyCode === 13 && !e.shiftKey)
			{
				$div.blur();
				return;
			}
		}
	)
	.on(
		'keyup',
		'.task-title',
		function()
		{
			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			var $div = $(this);

			// delete prev timer
			clearTimeout($div.data('save_timer'));

			// set new timer
			var save_timer = setTimeout(function()
			{
				self.save_title();
			}, 3000);
			
			$div.data('save_timer', save_timer);
		}
	)
	.on(
		'blur',
		'.task-title',
		function()
		{
			window.getSelection().removeAllRanges();

			if ( !current_user.has_cap('write') )
			{
				return false;
			}

			self.save_title();
		}
	); // task-title



	self.$el
	.on(
		'mouseenter',
		'.btn-task-action',
		function()
		{
			var $btn = $(this);
			var $dropdown = $btn.closest('.dropdown');

			if ( $dropdown.is('.open') )
			{
				return false;
			}

			var timer_open = setTimeout(function()
			{
				if ( $dropdown.is('.open') )
				{
					return false;
				}

				$btn.trigger('click');
			}, 500);
			
			$btn.data('timer-open', timer_open);
		}
	)
	.on(
		'mouseleave',
		'.btn-task-action',
		function()
		{
			var $btn = $(this);
			var $dropdown = $btn.closest('.dropdown');

			clearTimeout($btn.data('timer-open'));

			if ( $dropdown.is('.open') )
			{
				var timer_close = setTimeout(function()
				{
					$dropdown.removeClass('open'); // dropdown('toggle');

				}, 500);
				$dropdown.data('timer-close', timer_close);
			}
		}
	).on(
		'mouseenter',
		'.dropdown-menu',
		function()
		{
			var $menu = $(this);
			var $dropdown = $menu.closest('.dropdown');
			clearTimeout($dropdown.data('timer-close'));
		}
	);






	self.$el.on(
		'click',
		'.btn-task-move',
		function ()
		{
			var $btn = $(this);

			var modal = $btn.attr('data-target');
			var $modal = $(modal);

			$('.task-id', $modal).val(self.record.id);
			$('.task-title', $modal).html(self.record.title);

		}
	);





	self.$el.on(
		'click',
		'.btn-task-estimate',
		function ()
		{
			var $a = $(this);

			var estimate_id = $a.attr('data-id');
			self.record.estimate_id = estimate_id;
			self.save();

			var estimate = self.board().record.estimate_records()[estimate_id];
			$('.task-estimate', self.$el).html(estimate.title);

			self.update_progress();
		}
	);



	self.$el.on(
		'click',
		'.btn-task-assigned',
		function ()
		{
			var $a = $(this);

			var user_id = $a.attr('data-id');

			var user = self.board().record.allowed_users()[user_id];



			// build comment
			var comment = text['task_assigned_to'].sprintf(
				current_user.record().short_name,
				user.short_name
			);

			if ( typeof self.board().record.allowed_users()[self.record.user_id_assigned] !== 'undefined' )
			{
				var old_user = self.board().record.allowed_users()[self.record.user_id_assigned];

				comment += text['task_assigned_to_previous'].sprintf(
					old_user.short_name
				);
			}



			self.record.user_id_assigned = user_id;
			self.save(comment);



			self.$el.attr('data-user_id-assigned', user_id);

			var $initials = $('.task-assigned-initials', self.$el).removeClass('empty');
			
			if ( typeof user.avatar !== 'undefined' )
			{
				$initials.html(user.avatar);
			}
			else
			{
				$initials.text(user.initials);
			}

			$('.task-assigned-name', self.$el).text(user.short_name);
		}
	);



	self.$el.on(
		'click',
		'.btn-task-hour',
		function ()
		{
			var $btn = $(this);

			var operator = $btn.attr('data-operator');

			if ( operator != '+' && operator != '-' )
			{
				return false;
			}

			var current = parseFloat(self.record.hour_count);
			var interval = self.board().record.settings().hour_interval;

			// increase/decrease hours
			current = eval(current + operator + interval);

			// round to thousandth place
			// @link http://stackoverflow.com/a/11832950/38241
			current = Math.round(current * 1000) / 1000;

			if ( current < 0 )
			{
				current = 0;
			}

			// update the total count
			self.record.hour_count = current;

			$('.task-hours', self.$el).html(format_hours(self.record.hour_count));

			self.update_progress();
			self.log_work_hour(operator);

			return false;
		}
	);


}; // dom



Task.prototype.update_progress = function()
{
	// update progress bar
	var progress_percent = 0;
	if ( typeof this.record.estimate_id === 'undefined' && typeof this.record.hour_count === 'undefined' )
	{
		return;
	}

	var estimate = this.board().record.estimate_records()[this.record.estimate_id];

	if ( typeof estimate === 'undefined' )
	{
		return;
	}

	progress_percent = (parseFloat(this.record.hour_count)*100)/parseFloat(estimate.hours);

	var progress_type = 'success';
	if ( progress_percent > 133)
	{
		progress_type = 'danger';
	}
	else if ( progress_percent > 100 )
	{
		progress_type = 'warning';
	}

	if ( progress_percent > 100 )
	{
		progress_percent = 100;
	}

	$('.progress-bar', this.$el)
	.css({
		width: progress_percent + '%'
	})
	.removeClass('progress-bar-success progress-bar-warning progress-bar-danger')
	.addClass('progress-bar-' + progress_type);
}



Task.prototype.save = function(comment, status_id_old)
{
	if ( !current_user.has_cap('write') )
	{
		return false;
	}



	var task_data = {
		task: this.record,
		action: 'save_task',
		kanban_nonce: $('#kanban_nonce').val()
	};



	if ( typeof comment !== 'undefined' )
	{
		if ( comment !== null && comment !== '' )
		{
			task_data.comment = comment;
		}
	}

	if ( typeof status_id_old !== 'undefined' )
	{
		task_data.status_id_old = status_id_old;
	}



	$.ajax({
		method: "POST",
		url: ajaxurl,
		data: task_data
	})
	.done(function(response )
	{
		if ( !response.success )
		{
			growl (text.task_save_error);
			return false;
		}
	})
	.always(function(response)
	{
		// growl_response_message(response);
	});

}; // save



Task.prototype.delete = function(comment)
{
	if ( !current_user.has_cap('write') )
	{
		return false;
	}

	var self = this;

	var task_data = {
		task: this.record,
		action: 'delete_task',
		kanban_nonce: $('#kanban_nonce').val(),
		comment: text['task_deleted'].sprintf(
			current_user.record().short_name
		)
	};

	$.ajax({
		method: "POST",
		url: ajaxurl,
		data: task_data
	})
	.done(function(response)
	{
		if ( !response.success )
		{
			growl (text.task_delete_error);
			return false;
		}

		$(document).trigger('/task/deleted/', self.record);

		self.$el.slideUp('fast', function()
		{
			self.$el.remove();
			self.update_board();
			delete self.record;
		});
	});

}; // delete



Task.prototype.update_board = function()
{
	this.board().updates_status_counts();
	this.board().match_col_h ();
};



Task.prototype.update_status = function(status_id)
{
	if ( !current_user.has_cap('write') )
	{
		return false;
	}

	var status = this.board().record.status_records()[status_id];

	$('.task-handle', this.$el).css({
		background:status.color_hex
	});
}



Task.prototype.save_title = function()
{
	var $div = $('.task-title', this.$el);

	// prevent saving twice, if they blur instead of timeout
	clearTimeout($div.data('save_timer'));

	encode_urls_emails ($div);

	// store prev title
	var prev_title = this.record.title + '';

	var new_title = $div.html();

	var comment = text['task_title_updated'].sprintf(
		current_user.record().short_name,
		new_title
	);

	if ( prev_title !== '' )
	{
		comment += text['task_title_updated_previous'].sprintf(
			prev_title
		);
	}

	if ( new_title === '' || new_title === prev_title )
	{
		comment = null;
	}

	this.record.title = new_title;
	this.save(comment);

}; // save_title



Task.prototype.project_update_title = function (title)
{
	$('.task-project [contenteditable]', this.$el).text(title);
}



Task.prototype.project_save = function(project_id)
{
	// set project id (can't hurt)
	this.$el.attr('data-project-id', project_id);

	// get project
	var project = this.board().record.project_records[project_id];



	// update title (can't hurt)
	if ( typeof project === 'undefined' )
	{
		// set project title
		this.project_update_title('');
	}
	else
	{
		// set project title
		this.project_update_title(project.title);
	}



	// don't save if not change
	if ( project_id == this.record.project_id )
	{
		return;
	}



	if ( typeof project === 'undefined' )
	{
		// build comment
		var comment = text['task_removed_from_project'].sprintf(
			current_user.record().short_name
		);
	}
	else
	{
		// build comment
		var comment = text['task_added_to_project'].sprintf(
			current_user.record().short_name,
			project.title
		);
	}



	var prev_id = this.record.project_id;
	var prev_project = this.board().record.project_records[prev_id];

	if ( typeof prev_project !== 'undefined' )
	{
		comment += text['task_added_to_project_previous'].sprintf(
			prev_project.title
		);
	}



	// update task record and save it
	this.record.project_id = project_id;
	this.save(comment);
};




Task.prototype.parse_project = function()
{
	var self = this;

	var $div = $('.task-project [contenteditable]', this.$el);

	var project_title = $div.text();

	if ( typeof project_title === 'undefined' || project_title === '' || project_title === null )
	{
		return;
	}



	// see if typed value matches existing project
	var project_id = null;
	for ( var i in this.board().record.project_records )
	{
		var project = this.board().record.project_records[i];

		// it is NOT a new project
		if ( project_title === project.title )
		{
			project_id = project.id;
			break;
		}
	}



	if ( project_id !== null )
	{
		this.project_save(project_id);
		return;
	}



	var comment = text['project_added'].sprintf(
		current_user.record().short_name,
		project_title
	);



	var data = {
		action: 'save_project',
		post_type: 'kanban_project',
		kanban_nonce: $('#kanban_nonce').val(),
		project: {
			title: project_title
		},
		comment: comment
	};

	// save new project
	$.ajax({
		method: "POST",
		url: ajaxurl,
		data: data
	})
	.done(function(response )
	{

		// try
		// {
			// add project to available projects
			self.board().record.project_records[response.data.project.id] = response.data.project;
			self.project_save(response.data.project.id);
		// }
		// catch (err) {}
	});


}; // parse_project





Task.prototype.log_work_hour = function(operator)
{
	if ( !current_user.has_cap('write') )
	{
		return false;
	}

	var task_data = {
		task: this.record,
		action: 'add_task_hour',
		kanban_nonce: $('#kanban_nonce').val(),
		operator: operator
	};

	$.ajax({
		method: "POST",
		url: ajaxurl,
		data: task_data
	});
}; // add_work_hour
